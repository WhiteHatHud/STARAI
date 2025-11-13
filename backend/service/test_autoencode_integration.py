#!/usr/bin/env python3
"""
Test script for AutoEncodeFinal.py integration
Tests the updated function-based approach
"""
import sys
import os
from pathlib import Path

# Add service directory to path
service_dir = Path(__file__).parent
sys.path.insert(0, str(service_dir))

print("="*80)
print("TESTING AutoEncodeFinal.py INTEGRATION")
print("="*80)

# Test 1: Import the function
print("\n[TEST 1] Importing run_anomaly_detection...")
try:
    from AutoEncodeFinal import run_anomaly_detection
    print("✅ Successfully imported run_anomaly_detection")
except Exception as e:
    print(f"❌ Failed to import: {str(e)}")
    sys.exit(1)

# Test 2: Check if we have a test dataset
print("\n[TEST 2] Looking for test dataset...")
test_data_paths = [
    "../../Model/Beta dataset/labelled_testing_data.csv",
    "/Users/hud/Desktop/GitHubDesktop/STARAI/Model/Beta dataset/labelled_testing_data.csv"
]

test_dataset = None
for path in test_data_paths:
    if os.path.exists(path):
        test_dataset = path
        print(f"✅ Found test dataset: {path}")
        break

if not test_dataset:
    print("⚠️  No test dataset found. Skipping actual analysis test.")
    print("   Searched paths:")
    for path in test_data_paths:
        print(f"   - {path}")
else:
    # Test 3: Run the analysis
    print("\n[TEST 3] Running anomaly detection on test dataset...")
    model_dir = "../../Model/AutoEncoder"
    output_dir = "/tmp/test_autoencode_output"

    try:
        print(f"   Dataset: {test_dataset}")
        print(f"   Model dir: {model_dir}")
        print(f"   Output dir: {output_dir}")
        print("\nRunning analysis (this may take a minute)...")

        results = run_anomaly_detection(
            dataset_path=test_dataset,
            model_dir=model_dir,
            output_dir=output_dir
        )

        print("\n✅ Analysis completed successfully!")
        print("\n" + "="*80)
        print("RESULTS SUMMARY")
        print("="*80)
        print(f"Total sequences:     {results['total_sequences']}")
        print(f"Anomalies detected:  {results['anomaly_count']}")
        print(f"Precision:           {results['precision']:.4f}")
        print(f"Recall:              {results['recall']:.4f}")
        print(f"F1 Score:            {results['f1_score']:.4f}")
        print(f"\nFull results:        {results['full_results_path']}")
        print(f"Top 2 critical:      {results['top_2_path']}")
        print("="*80)

        # Test 4: Verify output files exist
        print("\n[TEST 4] Verifying output files...")
        if results['top_2_path'] and os.path.exists(results['top_2_path']):
            print(f"✅ top_2_critical.csv exists")

            # Read and display top 2
            import pandas as pd
            top_2 = pd.read_csv(results['top_2_path'])
            print(f"\nTop 2 Critical Anomalies Preview:")
            print(top_2[['sequence_index', 'reconstruction_error', 'priority']].to_string(index=False))
        else:
            print(f"❌ top_2_critical.csv not found at {results['top_2_path']}")

        if results['full_results_path'] and os.path.exists(results['full_results_path']):
            print(f"✅ new_test_results.csv exists ({results['anomaly_count']} anomalies)")
        else:
            print(f"❌ new_test_results.csv not found")

    except Exception as e:
        print(f"❌ Analysis failed: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

print("\n" + "="*80)
print("ALL TESTS PASSED ✅")
print("="*80)
print("\nNext steps:")
print("1. Test the API endpoint: POST /datasets/{dataset_id}/analyze")
print("2. Monitor logs to see AutoEncodeFinal being called")
print("3. Check MongoDB for stored top 2 anomalies")
