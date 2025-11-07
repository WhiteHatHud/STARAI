#!/usr/bin/env python3
"""
Generate sample Excel file with anomalies for testing.

This script creates a synthetic dataset resembling network traffic logs
with intentional anomalies for testing the anomaly detection system.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

np.random.seed(42)
random.seed(42)


def generate_normal_data(n_samples=500):
    """Generate normal (benign) network traffic data."""

    data = {
        'timestamp': [datetime.now() - timedelta(hours=i) for i in range(n_samples, 0, -1)],
        'user_id': np.random.randint(1000, 1050, n_samples),
        'ip_address': [f"192.168.1.{np.random.randint(1, 255)}" for _ in range(n_samples)],
        'request_count': np.random.poisson(15, n_samples),  # Normal: ~15 requests/hour
        'data_transfer_mb': np.random.normal(50, 15, n_samples),  # Normal: ~50MB ± 15
        'failed_logins': np.random.poisson(0.5, n_samples),  # Normal: <1 failures
        'response_time_ms': np.random.gamma(2, 50, n_samples),  # Normal: ~100ms
        'port': np.random.choice([80, 443, 8080, 3000], n_samples, p=[0.4, 0.4, 0.15, 0.05]),
        'status_code': np.random.choice([200, 201, 204, 301, 404], n_samples, p=[0.7, 0.1, 0.05, 0.1, 0.05]),
        'country': np.random.choice(['US', 'UK', 'CA', 'AU', 'DE'], n_samples, p=[0.5, 0.2, 0.15, 0.1, 0.05]),
        'device_type': np.random.choice(['desktop', 'mobile', 'tablet'], n_samples, p=[0.6, 0.3, 0.1])
    }

    # Keep data_transfer_mb positive
    data['data_transfer_mb'] = np.abs(data['data_transfer_mb'])

    return pd.DataFrame(data)


def inject_anomalies(df, n_anomalies=50):
    """Inject obvious anomalies into the dataset."""

    anomaly_indices = np.random.choice(df.index, n_anomalies, replace=False)

    print(f"\n🔴 Injecting {n_anomalies} anomalies:")

    for idx in anomaly_indices:
        anomaly_type = random.choice([
            'ddos_attack',
            'data_exfiltration',
            'brute_force',
            'unusual_port',
            'foreign_country',
            'response_spike'
        ])

        if anomaly_type == 'ddos_attack':
            # Extremely high request count
            df.at[idx, 'request_count'] = np.random.randint(500, 2000)
            df.at[idx, 'response_time_ms'] = np.random.randint(5000, 15000)
            print(f"  - Row {idx}: DDoS attack (requests={df.at[idx, 'request_count']})")

        elif anomaly_type == 'data_exfiltration':
            # Massive data transfer
            df.at[idx, 'data_transfer_mb'] = np.random.randint(500, 5000)
            df.at[idx, 'port'] = 9999  # Unusual port
            print(f"  - Row {idx}: Data exfiltration ({df.at[idx, 'data_transfer_mb']:.0f} MB)")

        elif anomaly_type == 'brute_force':
            # Many failed logins
            df.at[idx, 'failed_logins'] = np.random.randint(20, 100)
            df.at[idx, 'status_code'] = 401
            print(f"  - Row {idx}: Brute force attack ({df.at[idx, 'failed_logins']} failures)")

        elif anomaly_type == 'unusual_port':
            # Suspicious port
            df.at[idx, 'port'] = random.choice([22, 23, 3389, 4444, 31337])
            df.at[idx, 'request_count'] = np.random.randint(100, 300)
            print(f"  - Row {idx}: Unusual port (port={df.at[idx, 'port']})")

        elif anomaly_type == 'foreign_country':
            # Suspicious country + high activity
            df.at[idx, 'country'] = random.choice(['RU', 'CN', 'KP', 'IR'])
            df.at[idx, 'data_transfer_mb'] = np.random.randint(200, 800)
            print(f"  - Row {idx}: Foreign access ({df.at[idx, 'country']})")

        elif anomaly_type == 'response_spike':
            # Extremely slow response
            df.at[idx, 'response_time_ms'] = np.random.randint(10000, 30000)
            df.at[idx, 'status_code'] = 500
            print(f"  - Row {idx}: Response spike ({df.at[idx, 'response_time_ms']:.0f} ms)")

    return df, anomaly_indices


def main():
    print("="*70)
    print("STARAI - Test Data Generator")
    print("="*70)

    # Generate normal data
    print("\n1. Generating normal traffic data...")
    df = generate_normal_data(n_samples=500)
    print(f"   ✓ Created {len(df)} normal samples")

    # Inject anomalies
    print("\n2. Injecting anomalies...")
    df, anomaly_indices = inject_anomalies(df, n_anomalies=50)
    print(f"   ✓ Injected {len(anomaly_indices)} anomalies (~{len(anomaly_indices)/len(df)*100:.1f}%)")

    # Add ground truth labels (for validation, not used by detector)
    df['is_anomaly'] = 0
    df.loc[anomaly_indices, 'is_anomaly'] = 1

    # Shuffle rows
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)

    # Save to Excel
    output_file = "test_dataset_with_anomalies.xlsx"
    print(f"\n3. Saving to {output_file}...")
    df.to_excel(output_file, index=False, engine='openpyxl')

    print(f"   ✓ Saved {len(df)} rows")

    # Print summary
    print("\n" + "="*70)
    print("DATASET SUMMARY")
    print("="*70)
    print(f"Total rows: {len(df)}")
    print(f"Total columns: {len(df.columns)}")
    print(f"Anomalies (ground truth): {df['is_anomaly'].sum()} ({df['is_anomaly'].mean()*100:.1f}%)")
    print(f"\nColumns: {', '.join(df.columns.tolist())}")

    print("\n📊 Sample Statistics:")
    print(f"  request_count: mean={df['request_count'].mean():.1f}, max={df['request_count'].max()}")
    print(f"  data_transfer_mb: mean={df['data_transfer_mb'].mean():.1f}, max={df['data_transfer_mb'].max():.1f}")
    print(f"  failed_logins: mean={df['failed_logins'].mean():.2f}, max={df['failed_logins'].max()}")
    print(f"  response_time_ms: mean={df['response_time_ms'].mean():.1f}, max={df['response_time_ms'].max():.1f}")

    print("\n✅ Test file generated successfully!")
    print(f"\nNext steps:")
    print(f"  1. Upload '{output_file}' to STARAI")
    print(f"  2. Trigger analysis with: POST /api/anomaly/datasets/{{dataset_id}}/analyze-test")
    print(f"  3. Check results with: GET /api/anomaly/datasets/{{dataset_id}}/anomalies")
    print("\n")


if __name__ == '__main__':
    main()
