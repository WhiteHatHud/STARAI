import pandas as pd
import numpy as np
import sys
from pathlib import Path
from tensorflow import keras
from data_preprocessing import SequencePreprocessor
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score


def run_anomaly_detection(dataset_path, model_dir='../../Model/AutoEncoder', output_dir='.'):
    """
    Run autoencoder anomaly detection on a dataset.

    Args:
        dataset_path: Path to the CSV file to analyze
        model_dir: Directory containing the model files (Final.h5, preprocessor.pkl)
        output_dir: Directory to save output files (defaults to current directory)

    Returns:
        dict: Results containing anomaly count, file paths, and metrics
    """
    model_dir = Path(model_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 1. Load the trained model and preprocessor
    print("Loading model...")
    model = keras.models.load_model(str(model_dir / 'Final.h5'), compile=False)
    preprocessor = SequencePreprocessor.load(str(model_dir / 'preprocessor.pkl'))
    threshold = 2.62

    print(f"Anomaly threshold: {threshold:.6f}")

    # 2. Load the dataset
    print(f"Loading dataset from: {dataset_path}")
    test_data = pd.read_csv(dataset_path)
    print(f"Loaded {len(test_data)} system call events")

    # 3. Preprocess the data
    print("Preprocessing sequences...")
    X_test, y_test, metadata = preprocessor.create_sequences(
        test_data,
        fit_encoders=False  # Use existing encoders
    )
    X_test_scaled = preprocessor.scale_sequences(X_test, fit=False)

    print(f"Created {len(X_test_scaled)} sequences")

    # 4. Calculate reconstruction errors
    print("Calculating reconstruction errors...")
    X_reconstructed = model.predict(X_test_scaled, verbose=0)
    reconstruction_errors = np.mean(np.square(X_test_scaled - X_reconstructed), axis=(1, 2))

    # 5. Detect anomalies
    predictions = (reconstruction_errors > threshold).astype(int)
    anomaly_count = predictions.sum()

    print(f"\nResults:")
    print(f"- Anomalies detected: {anomaly_count}/{len(predictions)} ({anomaly_count/len(predictions)*100:.1f}%)")
    print(f"- Actual malicious: {y_test.sum()}/{len(y_test)} ({y_test.mean()*100:.1f}%)")
    print(f"- Mean reconstruction error: {reconstruction_errors.mean():.6f}")
    print(f"- Max reconstruction error: {reconstruction_errors.max():.6f}")

    # Calculate performance metrics
    print("\n" + "="*60)
    print("PERFORMANCE METRICS")
    print("="*60)

    # Confusion Matrix
    cm = confusion_matrix(y_test, predictions)
    tn, fp, fn, tp = cm.ravel()

    print("\nConfusion Matrix:")
    print(f"                Predicted")
    print(f"               Benign  Malicious")
    print(f"Actual Benign    {tn:<6}  {fp:<6}")
    print(f"       Malicious {fn:<6}  {tp:<6}")

    print(f"\nBreakdown:")
    print(f"  True Negatives (TN):  {tn:>4} - Correctly identified benign")
    print(f"  False Positives (FP): {fp:>4} - Benign flagged as malicious")
    print(f"  False Negatives (FN): {fn:>4} - Malicious missed")
    print(f"  True Positives (TP):  {tp:>4} - Correctly identified malicious")

    # Calculate metrics (handle division by zero)
    if (tp + fp) > 0:
        precision = precision_score(y_test, predictions)
    else:
        precision = 0.0

    if (tp + fn) > 0:
        recall = recall_score(y_test, predictions)
    else:
        recall = 0.0

    if (precision + recall) > 0:
        f1 = f1_score(y_test, predictions)
    else:
        f1 = 0.0

    # Calculate rates
    tpr = tp / (tp + fn) if (tp + fn) > 0 else 0  # True Positive Rate (Recall)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0  # False Positive Rate
    tnr = tn / (tn + fp) if (tn + fp) > 0 else 0  # True Negative Rate (Specificity)

    print("\n" + "="*60)
    print("KEY METRICS")
    print("="*60)
    print(f"Precision:    {precision:.4f} ({precision*100:.2f}%)")
    print(f"Recall (TPR): {recall:.4f} ({recall*100:.2f}%)")
    print(f"F1 Score:     {f1:.4f}")
    print(f"")
    print(f"True Positive Rate (TPR):  {tpr:.4f} ({tpr*100:.2f}%)")
    print(f"False Positive Rate (FPR): {fpr:.4f} ({fpr*100:.2f}%)")
    print(f"Specificity (TNR):         {tnr:.4f} ({tnr*100:.2f}%)")
    print("="*60)

    # 6. Assign priorities to anomalies
    results_dict = {
        'anomaly_count': int(anomaly_count),
        'total_sequences': len(predictions),
        'precision': float(precision),
        'recall': float(recall),
        'f1_score': float(f1),
        'max_reconstruction_error': float(reconstruction_errors.max()),
        'mean_reconstruction_error': float(reconstruction_errors.mean()),
        'full_results_path': None,
        'top_2_path': None
    }

    if anomaly_count > 0:
        anomaly_indices = np.where(predictions == 1)[0]
        anomaly_errors = reconstruction_errors[anomaly_indices]

        # Calculate priority quartiles
        q75 = np.percentile(anomaly_errors, 75)
        q50 = np.percentile(anomaly_errors, 50)
        q25 = np.percentile(anomaly_errors, 25)

        priorities = []
        for error in anomaly_errors:
            if error >= q75:
                priorities.append('CRITICAL')
            elif error >= q50:
                priorities.append('HIGH')
            elif error >= q25:
                priorities.append('MEDIUM')
            else:
                priorities.append('LOW')

        # 7. Create results DataFrame with additional context
        # Extract ALL columns from original data for each anomaly
        print(f"Extracting full information for {len(anomaly_indices)} anomalies...")

        # OPTIMIZED: Group data once instead of filtering 6366 times
        print("Grouping test data by process (this may take a moment)...")
        grouped_data = test_data.groupby(['hostName', 'processId'])

        # Build efficient lookup
        print("Building process lookup...")
        process_groups = {}
        for (host, pid), group in grouped_data:
            process_groups[(host, pid)] = group.reset_index(drop=True)

        # Extract rows efficiently
        print("Extracting anomaly rows...")
        anomaly_rows = []
        for idx in anomaly_indices:
            meta = metadata[idx]
            key = (meta['hostName'], meta['processId'])

            if key in process_groups:
                process_data = process_groups[key]
                start_idx = meta['start_idx']

                if start_idx < len(process_data):
                    # Get the first row of this sequence
                    row = process_data.iloc[start_idx].to_dict()
                else:
                    # Fallback: use first row from this process
                    row = process_data.iloc[0].to_dict()
            else:
                # Fallback: create minimal row
                row = {
                    'hostName': meta['hostName'],
                    'processId': meta['processId']
                }

            anomaly_rows.append(row)

        # Create DataFrame from original data rows
        print("Creating results DataFrame...")
        results = pd.DataFrame(anomaly_rows)

        # Add detection-specific columns
        results.insert(0, 'sequence_index', anomaly_indices)
        results['reconstruction_error'] = anomaly_errors
        results['priority'] = priorities

        # Sort by error (most critical first)
        results = results.sort_values('reconstruction_error', ascending=False)

        # 8. Display top threats
        print("\n" + "="*80)
        print("TOP 10 MOST CRITICAL ANOMALIES")
        print("="*80)
        print(results.head(10).to_string(index=False))

        # Save full results
        full_results_path = output_dir / 'new_test_results.csv'
        results.to_csv(full_results_path, index=False)
        print("\n" + "="*80)
        print(f"✅ Full results saved to: {full_results_path} ({len(results)} anomalies)")

        # Also save just the top 2 critical
        top_2_path = output_dir / 'top_2_critical.csv'
        results.head(2).to_csv(top_2_path, index=False)
        print(f"✅ Top 2 critical saved to: {top_2_path}")
        print("="*80)

        results_dict['full_results_path'] = str(full_results_path)
        results_dict['top_2_path'] = str(top_2_path)
    else:
        print("\nNo anomalies detected - all sequences appear normal!")

    # 9. Save numpy arrays for visualization generation
    print("\nSaving test results for visualization generation...")
    np.save(output_dir / 'y_test.npy', y_test)
    np.save(output_dir / 'y_pred.npy', predictions)
    np.save(output_dir / 'test_mse.npy', reconstruction_errors)
    print("✅ Saved: y_test.npy, y_pred.npy, test_mse.npy")

    return results_dict


if __name__ == "__main__":
    # Command-line interface
    if len(sys.argv) < 2:
        print("Usage: python AutoEncodeFinal.py <dataset_path> [model_dir] [output_dir]")
        sys.exit(1)

    dataset_path = sys.argv[1]
    model_dir = sys.argv[2] if len(sys.argv) > 2 else '../../Model/AutoEncoder'
    output_dir = sys.argv[3] if len(sys.argv) > 3 else '.'

    results = run_anomaly_detection(dataset_path, model_dir, output_dir)
    print("\n" + "="*80)
    print("ANALYSIS COMPLETE")
    print("="*80)
    print(f"Anomalies found: {results['anomaly_count']}/{results['total_sequences']}")
    print(f"Top 2 critical saved to: {results['top_2_path']}")
    print("="*80)