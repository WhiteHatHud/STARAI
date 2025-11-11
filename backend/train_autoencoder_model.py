"""
One-time script to train the autoencoder model for anomaly detection.

This script should be run ONCE with a large, representative dataset of NORMAL data.
The trained model will be saved and reused for all future uploads, eliminating the
need to retrain on every dataset upload.

Usage:
    python train_autoencoder_model.py <training_data_file> [--output-dir MODEL_DIR]

Example:
    python train_autoencoder_model.py data/normal_samples.xlsx
    python train_autoencoder_model.py data/normal_samples.csv --output-dir Model/AutoEncoder

Requirements:
    - Training data should be mostly normal (non-anomalous) data
    - Larger datasets produce better models (recommended: 10,000+ rows)
    - Data should be representative of the types of data you'll analyze
"""

import argparse
import sys
import os
import pandas as pd
from pathlib import Path

# Add parent directory to path to import from app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.anomaly_detector import TabularAnomalyDetector


def train_model(training_data_path: str, output_dir: str = "Model/AutoEncoder"):
    """
    Train autoencoder on representative dataset.

    Args:
        training_data_path: Path to Excel/CSV with normal data
        output_dir: Directory to save trained model (will be created if doesn't exist)
    """
    print("=" * 80)
    print("Autoencoder Training Script")
    print("=" * 80)

    # Load training data
    print(f"\n[1/4] Loading training data from: {training_data_path}")

    if not os.path.exists(training_data_path):
        print(f"❌ Error: Training data file not found: {training_data_path}")
        sys.exit(1)

    try:
        if training_data_path.endswith('.csv'):
            df = pd.read_csv(training_data_path)
        elif training_data_path.endswith('.xlsx') or training_data_path.endswith('.xls'):
            df = pd.read_excel(training_data_path, sheet_name=0)
        else:
            print(f"❌ Error: Unsupported file format. Use .csv, .xlsx, or .xls")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Error loading file: {str(e)}")
        sys.exit(1)

    print(f"✓ Loaded {len(df):,} rows × {len(df.columns)} columns")
    print(f"  Columns: {', '.join(df.columns[:10])}" + ("..." if len(df.columns) > 10 else ""))

    # Validate data
    if len(df) < 100:
        print("\n⚠️  Warning: Training data has less than 100 rows.")
        print("   For best results, use at least 10,000 rows of normal data.")
        response = input("   Continue anyway? (y/N): ")
        if response.lower() != 'y':
            print("Aborted.")
            sys.exit(0)

    # Create detector
    print("\n[2/4] Initializing autoencoder detector...")
    detector = TabularAnomalyDetector(
        encoding_dim=8,
        threshold_percentile=95
    )
    print("✓ Detector initialized")

    # Train model
    print("\n[3/4] Training autoencoder model...")
    print("   This may take several minutes depending on dataset size...")
    print(f"   Training parameters:")
    print(f"     - Encoding dimension: 8")
    print(f"     - Threshold percentile: 95")
    print(f"     - Epochs: 50")
    print(f"     - Batch size: 64")
    print(f"     - Validation split: 20%")
    print()

    try:
        history = detector.train(
            df,
            epochs=50,
            batch_size=64,
            validation_split=0.2
        )
        print("\n✓ Training complete!")
    except Exception as e:
        print(f"\n❌ Training failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    # Save model
    print(f"\n[4/4] Saving trained model to: {output_dir}")

    # Create output directory
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    try:
        detector.save(output_dir)
        print(f"✓ Model saved successfully!")
    except Exception as e:
        print(f"❌ Failed to save model: {str(e)}")
        sys.exit(1)

    # Print summary
    print("\n" + "=" * 80)
    print("Training Summary")
    print("=" * 80)
    print(f"Model directory:    {output_dir}")
    print(f"Files created:      - {output_dir}/autoencoder.h5")
    print(f"                    - {output_dir}/metadata.pkl")
    print(f"Threshold:          {detector.threshold:.6f}")
    print(f"Features:           {len(detector.feature_names)}")
    print(f"Feature names:      {', '.join(detector.feature_names[:5])}" + ("..." if len(detector.feature_names) > 5 else ""))

    # Test on training data
    print("\n" + "=" * 80)
    print("Validation Check")
    print("=" * 80)
    print("Running anomaly detection on training data...")

    try:
        anomalies = detector.detect_anomalies(df)
        anomaly_rate = len(anomalies) / len(df) * 100

        print(f"✓ Detected {len(anomalies):,} anomalies out of {len(df):,} rows ({anomaly_rate:.2f}%)")

        if anomaly_rate > 10:
            print("\n⚠️  Warning: High anomaly rate in training data!")
            print("   Training data should be mostly normal (non-anomalous).")
            print("   Consider using cleaner training data for better results.")
        elif anomaly_rate < 1:
            print("\n✓ Excellent! Low anomaly rate indicates clean training data.")
        else:
            print("\n✓ Good! Anomaly rate is within acceptable range (1-10%).")

    except Exception as e:
        print(f"❌ Validation failed: {str(e)}")

    print("\n" + "=" * 80)
    print("✅ Training Complete!")
    print("=" * 80)
    print("\nNext steps:")
    print("1. The model is now ready to use")
    print("2. Upload datasets via the API - analysis should complete in 5-10 seconds")
    print("3. The backend will automatically load this pre-trained model")
    print(f"\nNote: The model files are located at: {os.path.abspath(output_dir)}")


def main():
    parser = argparse.ArgumentParser(
        description="Train autoencoder model for anomaly detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python train_autoencoder_model.py data/normal_data.xlsx
  python train_autoencoder_model.py data/normal_data.csv --output-dir models/autoencoder_v1

The output directory will contain:
  - autoencoder.h5: Trained Keras model
  - metadata.pkl: Preprocessors, encoders, threshold, feature names
        """
    )

    parser.add_argument(
        'training_data',
        help='Path to training data file (.csv, .xlsx, or .xls)'
    )

    parser.add_argument(
        '--output-dir',
        default='Model/AutoEncoder',
        help='Directory to save trained model (default: Model/AutoEncoder)'
    )

    args = parser.parse_args()

    train_model(args.training_data, args.output_dir)


if __name__ == "__main__":
    main()
