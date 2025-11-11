"""
Test the autoencoder service
Can fetch datasets from:
1. S3 by dataset ID (requires MongoDB connection)
2. Local file path
"""
import pandas as pd
import sys
import os
from pathlib import Path
from io import BytesIO, StringIO
from autoencoder_service import AutoencoderService

# Add app directory to path for imports
app_dir = Path(__file__).resolve().parent.parent / "app"
sys.path.insert(0, str(app_dir))


def load_dataset_from_s3(dataset_id: str) -> pd.DataFrame:
    """
    Load dataset from S3 using dataset ID from MongoDB.

    Args:
        dataset_id: MongoDB ObjectId as string

    Returns:
        DataFrame with dataset content
    """
    from bson import ObjectId
    from database.connection import datasets_collection
    from core.s3_manager import s3_manager

    print(f"Fetching dataset {dataset_id} from database...")

    # Get dataset record from MongoDB
    dataset_doc = datasets_collection.find_one({"_id": ObjectId(dataset_id)})

    if not dataset_doc:
        raise ValueError(f"Dataset {dataset_id} not found in database")

    s3_key = dataset_doc['s3_key']
    filename = dataset_doc['filename']

    print(f"Downloading from S3: {s3_key}")

    # Download file from S3
    file_content = s3_manager.get_object_stream(s3_key).read()

    # Parse based on file type
    is_csv = filename.lower().endswith('.csv')

    if is_csv:
        try:
            text_content = file_content.decode('utf-8')
        except UnicodeDecodeError:
            text_content = file_content.decode('latin-1')
        df = pd.read_csv(StringIO(text_content))
    else:
        df = pd.read_excel(BytesIO(file_content), sheet_name=0)

    print(f"✓ Loaded dataset: {len(df)} rows, {len(df.columns)} columns")
    return df


def load_dataset_from_file(file_path: str) -> pd.DataFrame:
    """
    Load dataset from local file path.

    Args:
        file_path: Path to CSV or Excel file

    Returns:
        DataFrame with dataset content
    """
    print(f"Loading dataset from file: {file_path}")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Determine file type and load
    if file_path.lower().endswith('.csv'):
        df = pd.read_csv(file_path)
    elif file_path.lower().endswith(('.xlsx', '.xls')):
        df = pd.read_excel(file_path, sheet_name=0)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")

    print(f"✓ Loaded dataset: {len(df)} rows, {len(df.columns)} columns")
    return df


def main(dataset_source: str = None):
    """
    Main function to test autoencoder service.

    Args:
        dataset_source: Either:
            - MongoDB ObjectId (24-char hex string) to load from S3
            - File path to load from local file
            - None to use default local file
    """
    # Initialize service
    print("Initializing AutoencoderService...")
    service = AutoencoderService(
        model_path="../../Model/AutoEncoder/Final.h5",
        preprocessor_path="../../Model/AutoEncoder/preprocessor.pkl",
        threshold_path="../../Model/AutoEncoder/threshold.npy"
    )

    # Load dataset
    if dataset_source is None:
        # Default: use local file
        df = load_dataset_from_file("../../Model/Beta dataset/labelled_testing_data.csv")
    elif len(dataset_source) == 24 and all(c in '0123456789abcdef' for c in dataset_source.lower()):
        # Looks like MongoDB ObjectId - load from S3
        df = load_dataset_from_s3(dataset_source)
    else:
        # Treat as file path
        df = load_dataset_from_file(dataset_source)

    # Run analysis
    print("\nRunning anomaly detection...")
    results = service.analyze_dataset(df)

    # Display results
    print("\n" + "="*80)
    print("ANALYSIS RESULTS")
    print("="*80)

    # Get anomalies only
    anomalies = results[results['anomaly_prediction'] == 1]
    print(f"\nTotal sequences analyzed: {len(results)}")
    print(f"Anomalies detected: {len(anomalies)} ({len(anomalies)/len(results)*100:.2f}%)")

    if len(anomalies) > 0:
        print("\nTop 10 Anomalies:")
        # Display columns that exist in the dataset
        display_cols = ['anomaly_score', 'reconstruction_error', 'sequence_id']
        # Add other columns if they exist
        for col in ['processName', 'eventName', 'original_row_index']:
            if col in anomalies.columns:
                display_cols.append(col)

        print(anomalies[display_cols].head(10).to_string())

        # Get top N anomalies
        top_n = min(20, len(anomalies))
        top_anomalies = service.get_top_anomalies(df, top_n=top_n)
        print(f"\nTop {len(top_anomalies)} Highest-Scoring Anomalies:")
        print(top_anomalies[display_cols].head(5).to_string())
    else:
        print("\nNo anomalies detected!")

    # Save results
    print("\n" + "="*80)
    print("SAVING RESULTS")
    print("="*80)

    results.to_csv("autoencoder_results.csv", index=False)
    print("✓ Full results saved to: autoencoder_results.csv")

    if len(anomalies) > 0:
        anomalies.to_csv("anomalies_only.csv", index=False)
        print("✓ Anomalies saved to: anomalies_only.csv")

        top_anomalies.to_csv("top_anomalies.csv", index=False)
        print("✓ Top anomalies saved to: top_anomalies.csv")

    print("\n✓ Analysis complete!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Test Autoencoder Service')
    parser.add_argument(
        '--dataset',
        type=str,
        help='Dataset source: MongoDB ObjectId (24-char hex) or file path. If not provided, uses default local file.'
    )

    args = parser.parse_args()

    try:
        main(dataset_source=args.dataset)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)