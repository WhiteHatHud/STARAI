#!/bin/bash
# Quick test script for anomaly detection

set -e  # Exit on error

echo "============================================================"
echo "STARAI - Anomaly Detection Quick Test"
echo "============================================================"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Install it with: brew install jq"
    exit 1
fi

# Step 1: Generate test data
echo ""
echo "Step 1: Generating test data..."
python3 generate_test_data.py

if [ ! -f "test_dataset_with_anomalies.xlsx" ]; then
    echo "Error: Failed to generate test file"
    exit 1
fi

# Step 2: Login and get token
echo ""
echo "Step 2: Authenticating..."
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" \
  | jq -r '.access_token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
    echo "Error: Failed to authenticate. Check your credentials."
    exit 1
fi

echo "✓ Authentication successful"

# Step 3: Upload dataset
echo ""
echo "Step 3: Uploading dataset..."
UPLOAD_RESPONSE=$(curl -s -X POST \
  "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_dataset_with_anomalies.xlsx")

DATASET_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')

if [ "$DATASET_ID" == "null" ] || [ -z "$DATASET_ID" ]; then
    echo "Error: Failed to upload dataset"
    echo "$UPLOAD_RESPONSE" | jq .
    exit 1
fi

echo "✓ Dataset uploaded successfully"
echo "  Dataset ID: $DATASET_ID"

# Step 4: Trigger analysis
echo ""
echo "Step 4: Analyzing dataset (this will take 30-60 seconds)..."
ANALYSIS_START=$(date +%s)

ANALYSIS_RESPONSE=$(curl -s -X POST \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze-test" \
  -H "Authorization: Bearer $TOKEN")

ANALYSIS_END=$(date +%s)
ANALYSIS_TIME=$((ANALYSIS_END - ANALYSIS_START))

STATUS=$(echo "$ANALYSIS_RESPONSE" | jq -r '.status')

if [ "$STATUS" != "completed" ]; then
    echo "Error: Analysis failed"
    echo "$ANALYSIS_RESPONSE" | jq .
    exit 1
fi

echo "✓ Analysis completed in ${ANALYSIS_TIME} seconds"
echo ""
echo "$ANALYSIS_RESPONSE" | jq .

# Step 5: Get anomalies
echo ""
echo "Step 5: Retrieving detected anomalies..."
ANOMALIES=$(curl -s -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies" \
  -H "Authorization: Bearer $TOKEN")

ANOMALY_COUNT=$(echo "$ANOMALIES" | jq 'length')

echo "✓ Retrieved $ANOMALY_COUNT anomalies"
echo ""
echo "Sample anomaly:"
echo "$ANOMALIES" | jq '.[0]'

# Summary
echo ""
echo "============================================================"
echo "TEST COMPLETE ✅"
echo "============================================================"
echo "Total rows: $(echo "$ANALYSIS_RESPONSE" | jq -r '.total_rows')"
echo "Anomalies detected: $ANOMALY_COUNT"
echo "Detection percentage: $(echo "$ANALYSIS_RESPONSE" | jq -r '.anomaly_percentage')"
echo "Threshold used: $(echo "$ANALYSIS_RESPONSE" | jq -r '.threshold_used')"
echo ""
echo "View all anomalies:"
echo "  curl -X GET \"http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies\" \\"
echo "    -H \"Authorization: Bearer $TOKEN\" | jq ."
echo ""
echo "Dataset ID: $DATASET_ID"
echo "============================================================"
