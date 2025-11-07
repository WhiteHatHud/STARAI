#!/usr/bin/env python3
"""
Prepare BETH dataset for STARAI anomaly detection testing.

This script converts the BETH CSV dataset to Excel format and samples it
to a manageable size for testing.
"""

import pandas as pd
import numpy as np
import sys
from pathlib import Path

def prepare_beth_dataset(
    input_csv: str,
    output_xlsx: str,
    sample_size: int = 5000,
    include_evil: bool = True
):
    """
    Prepare BETH dataset for testing.

    Args:
        input_csv: Path to labelled_testing_data.csv
        output_xlsx: Output Excel file path
        sample_size: Number of rows to sample
        include_evil: Whether to include evil samples
    """

    print("="*70)
    print("BETH Dataset Preparation for STARAI")
    print("="*70)

    # Read CSV
    print(f"\n1. Reading CSV file: {input_csv}")
    print(f"   (This may take 30-60 seconds for 55MB file...)")

    df = pd.read_csv(input_csv)

    print(f"   ✓ Loaded {len(df):,} rows")
    print(f"   ✓ {len(df.columns)} columns")

    # Show distribution
    evil_count = df['evil'].sum()
    sus_count = df['sus'].sum()

    print(f"\n2. Dataset composition:")
    print(f"   Evil (malicious): {evil_count:,} ({evil_count/len(df)*100:.2f}%)")
    print(f"   Suspicious: {sus_count:,} ({sus_count/len(df)*100:.2f}%)")
    print(f"   Normal: {len(df) - evil_count:,} ({(1-evil_count/len(df))*100:.2f}%)")

    # Sample dataset
    if sample_size and sample_size < len(df):
        print(f"\n3. Sampling {sample_size:,} rows...")

        if include_evil and evil_count > 0:
            # Stratified sampling to preserve evil ratio
            evil_sample_size = int(sample_size * (evil_count / len(df)))
            normal_sample_size = sample_size - evil_sample_size

            evil_df = df[df['evil'] == 1].sample(n=min(evil_sample_size, evil_count), random_state=42)
            normal_df = df[df['evil'] == 0].sample(n=normal_sample_size, random_state=42)

            df_sample = pd.concat([normal_df, evil_df]).sample(frac=1, random_state=42).reset_index(drop=True)

            print(f"   ✓ Sampled {len(df_sample):,} rows (stratified)")
            print(f"   ✓ Evil samples: {df_sample['evil'].sum():,} ({df_sample['evil'].mean()*100:.2f}%)")
        else:
            df_sample = df.sample(n=sample_size, random_state=42).reset_index(drop=True)
            print(f"   ✓ Sampled {len(df_sample):,} rows (random)")
    else:
        df_sample = df
        print(f"\n3. Using full dataset ({len(df):,} rows)")

    # Simplify args column (it's too complex for Excel)
    if 'args' in df_sample.columns:
        print(f"\n4. Simplifying 'args' column...")
        df_sample['args_length'] = df_sample['args'].str.len()
        df_sample = df_sample.drop('args', axis=1)
        print(f"   ✓ Replaced 'args' with 'args_length'")

    # Simplify stackAddresses
    if 'stackAddresses' in df_sample.columns:
        print(f"\n5. Simplifying 'stackAddresses' column...")
        df_sample['stack_depth'] = df_sample['stackAddresses'].str.count(',') + 1
        df_sample = df_sample.drop('stackAddresses', axis=1)
        print(f"   ✓ Replaced 'stackAddresses' with 'stack_depth'")

    # Convert timestamp to numeric (easier for ML)
    if 'timestamp' in df_sample.columns:
        print(f"\n6. Converting timestamp to numeric...")
        df_sample['timestamp_numeric'] = pd.to_numeric(df_sample['timestamp'], errors='coerce')
        print(f"   ✓ Added 'timestamp_numeric'")

    # Save to Excel
    print(f"\n7. Saving to Excel: {output_xlsx}")
    df_sample.to_excel(output_xlsx, index=False, engine='openpyxl')

    file_size_mb = Path(output_xlsx).stat().st_size / (1024 * 1024)
    print(f"   ✓ Saved {len(df_sample):,} rows")
    print(f"   ✓ File size: {file_size_mb:.2f} MB")

    # Summary
    print("\n" + "="*70)
    print("DATASET PREPARED SUCCESSFULLY")
    print("="*70)
    print(f"Output file: {output_xlsx}")
    print(f"Total rows: {len(df_sample):,}")
    print(f"Total columns: {len(df_sample.columns)}")
    print(f"Ground truth anomalies: {df_sample['evil'].sum():,} ({df_sample['evil'].mean()*100:.2f}%)")

    print(f"\nColumns in output:")
    for col in df_sample.columns:
        print(f"  - {col}")

    print(f"\nNext steps:")
    print(f"  1. Upload '{output_xlsx}' to STARAI")
    print(f"  2. Trigger analysis: POST /api/anomaly/datasets/{{id}}/analyze-test")
    print(f"  3. Compare detected anomalies with ground truth (evil column)")
    print("")

    return df_sample


def main():
    """Main function"""

    # Paths
    input_csv = "Model/Beta dataset/labelled_testing_data.csv"
    output_xlsx = "beth_testing_dataset.xlsx"

    # Check if file exists
    if not Path(input_csv).exists():
        print(f"Error: File not found: {input_csv}")
        print(f"\nPlease ensure the BETH dataset is in the correct location:")
        print(f"  {Path(input_csv).absolute()}")
        sys.exit(1)

    # Prepare dataset
    df_sample = prepare_beth_dataset(
        input_csv=input_csv,
        output_xlsx=output_xlsx,
        sample_size=5000,  # Sample 5000 rows for testing
        include_evil=True   # Keep evil samples
    )

    # Show sample
    print("\n" + "="*70)
    print("SAMPLE DATA (first 3 rows):")
    print("="*70)
    print(df_sample.head(3).to_string())
    print("")


if __name__ == '__main__':
    # Check dependencies
    try:
        import pandas as pd
        import openpyxl
    except ImportError as e:
        print(f"Error: Missing dependency: {e}")
        print(f"\nInstall with:")
        print(f"  pip3 install pandas openpyxl")
        sys.exit(1)

    main()
