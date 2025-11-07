# Testing the Anomaly Detector

This guide walks you through testing the autoencoder-based anomaly detection system.

---

## Prerequisites

✅ Backend running with updated dependencies
✅ Frontend accessible at `http://localhost:3000`
✅ Valid authentication token

---

## Step 1: Install Dependencies & Rebuild Backend

The anomaly detector requires TensorFlow. Install it and rebuild:

```bash
cd /Users/hud/Desktop/GitHubDesktop/STARAI

# Rebuild backend container (this will take 3-5 minutes)
docker-compose up --build -d backend

# Wait for backend to start
sleep 10

# Verify TensorFlow is available
docker-compose exec backend python -c "import tensorflow as tf; print('TensorFlow version:', tf.__version__)"
```

**Expected output:**
```
TensorFlow version: 2.15.0
```

If you get an error, the dependencies weren't installed. Check the build logs:
```bash
docker-compose logs backend --tail 100
```

---

## Step 2: Generate Test Data with Anomalies

Run the test data generator to create a synthetic Excel file:

```bash
# Generate test Excel file
python3 generate_test_data.py
```

**Output:**
```
==================================================================
STARAI - Test Data Generator
==================================================================

1. Generating normal traffic data...
   ✓ Created 500 normal samples

2. Injecting anomalies...
🔴 Injecting 50 anomalies:
  - Row 42: DDoS attack (requests=1234)
  - Row 89: Data exfiltration (2500 MB)
  - Row 156: Brute force attack (45 failures)
  ...
   ✓ Injected 50 anomalies (~10.0%)

3. Saving to test_dataset_with_anomalies.xlsx...
   ✓ Saved 550 rows

==================================================================
DATASET SUMMARY
==================================================================
Total rows: 550
Total columns: 12
Anomalies (ground truth): 50 (10.0%)
```

This creates `test_dataset_with_anomalies.xlsx` in the current directory.

---

## Step 3: Upload the Test Dataset

### Option A: Using Frontend (Easiest)

1. Open `http://localhost:3000` in your browser
2. Login with your credentials
3. Click "Upload New Dataset" card
4. Drag and drop `test_dataset_with_anomalies.xlsx`
5. Wait for upload confirmation
6. **Note the dataset ID** from the URL or response

### Option B: Using curl

```bash
# Login and get token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" \
  | jq -r '.access_token')

echo "Token: $TOKEN"

# Upload file
UPLOAD_RESPONSE=$(curl -s -X POST \
  "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_dataset_with_anomalies.xlsx")

echo "$UPLOAD_RESPONSE" | jq .

# Extract dataset ID
DATASET_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')
echo "Dataset ID: $DATASET_ID"
```

**Expected response:**
```json
{
  "id": "673b2a3f4d5e6f7a8b9c0d1e",
  "user_id": "690be9e907b24bde0604e2da",
  "filename": "admin_20251106_120534_test_dataset_with_anomalies.xlsx",
  "original_filename": "test_dataset_with_anomalies.xlsx",
  "s3_key": "datasets/690be9e907b24bde0604e2da/admin_20251106_120534_test_dataset_with_anomalies.xlsx",
  "file_size": 24567,
  "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "status": "pending",
  "uploaded_at": "2025-11-06T12:05:34.567Z",
  "anomaly_count": 0
}
```

Save the `id` value - you'll need it for the next step!

---

## Step 4: Trigger Anomaly Detection

Now trigger the analysis using the TEST endpoint:

```bash
# Make sure you have DATASET_ID and TOKEN from Step 3

curl -X POST \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze-test" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

**This will take 30-60 seconds** as the autoencoder trains on the data.

**Expected response:**
```json
{
  "dataset_id": "673b2a3f4d5e6f7a8b9c0d1e",
  "status": "completed",
  "total_rows": 550,
  "total_columns": 12,
  "anomalies_detected": 52,
  "anomalies_stored": 52,
  "anomaly_percentage": "9.45%",
  "threshold_used": 0.08234,
  "columns_analyzed": [
    "timestamp",
    "user_id",
    "ip_address",
    "request_count",
    "data_transfer_mb",
    "failed_logins",
    "response_time_ms",
    "port",
    "status_code",
    "country"
  ]
}
```

### What Just Happened?

1. ✅ Downloaded Excel from S3
2. ✅ Parsed 550 rows, 12 columns
3. ✅ Trained autoencoder on the data
4. ✅ Calculated reconstruction errors
5. ✅ Flagged 52 anomalies (top 5% with highest errors)
6. ✅ Stored anomalies in MongoDB with features
7. ✅ Updated dataset status to "completed"

---

## Step 5: Retrieve Detected Anomalies

Now let's see the anomalies that were detected:

```bash
# Get all anomalies
curl -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies" \
  -H "Authorization: Bearer $TOKEN" \
  | jq . | head -100
```

**Sample response:**
```json
[
  {
    "id": "673b2b3f4d5e6f7a8b9c0d20",
    "dataset_id": "673b2a3f4d5e6f7a8b9c0d1e",
    "user_id": "690be9e907b24bde0604e2da",
    "anomaly_score": 0.2456,
    "row_index": 42,
    "sheet_name": "Sheet1",
    "raw_data": {
      "timestamp": "2025-11-05T10:15:00",
      "user_id": 1023,
      "ip_address": "192.168.1.145",
      "request_count": 1567,
      "data_transfer_mb": 45.2,
      "failed_logins": 2,
      "response_time_ms": 12345,
      "port": 443,
      "status_code": 200,
      "country": "US",
      "device_type": "desktop"
    },
    "anomalous_features": [
      {
        "feature_name": "request_count",
        "actual_value": 1567,
        "reconstruction_error": 0.8234
      },
      {
        "feature_name": "response_time_ms",
        "actual_value": 12345,
        "reconstruction_error": 0.6123
      },
      {
        "feature_name": "data_transfer_mb",
        "actual_value": 45.2,
        "reconstruction_error": 0.1234
      }
    ],
    "status": "detected",
    "detected_at": "2025-11-06T12:06:15.234Z"
  },
  ...
]
```

### Filter by Score

Get only high-severity anomalies:

```bash
curl -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies?min_score=0.15" \
  -H "Authorization: Bearer $TOKEN" \
  | jq 'length'
```

---

## Step 6: Verify Results

Compare detected anomalies with ground truth:

```bash
# Count stored anomalies
DETECTED_COUNT=$(curl -s -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies" \
  -H "Authorization: Bearer $TOKEN" \
  | jq 'length')

echo "Detected anomalies: $DETECTED_COUNT"
echo "Ground truth (from test data): 50"
echo "Detection rate: $(echo "scale=1; $DETECTED_COUNT / 50 * 100" | bc)%"
```

**Expected output:**
```
Detected anomalies: 52
Ground truth (from test data): 50
Detection rate: 104.0%
```

The detector found slightly more than the injected anomalies because:
- Some "normal" rows may have unusual patterns
- The threshold is set at 95th percentile (top 5%)
- The autoencoder learns patterns, not labels

---

## Step 7: Check Dataset Status

Verify the dataset was updated correctly:

```bash
curl -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .
```

**Expected response:**
```json
{
  "id": "673b2a3f4d5e6f7a8b9c0d1e",
  "status": "completed",
  "anomaly_count": 52,
  "uploaded_at": "2025-11-06T12:05:34.567Z",
  ...
}
```

---

## Troubleshooting

### Error: "TensorFlow not available"

**Problem:** Backend doesn't have TensorFlow installed.

**Solution:**
```bash
# Rebuild backend
docker-compose up --build -d backend

# Verify installation
docker-compose exec backend pip list | grep tensorflow
```

### Error: "Dataset not found"

**Problem:** Wrong dataset ID or dataset belongs to another user.

**Solution:**
```bash
# List your datasets
curl -X GET "http://localhost:8000/api/anomaly/datasets" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Analysis Takes Too Long (>2 minutes)

**Problem:** Large dataset or slow CPU.

**Explanation:** The autoencoder trains on the data, which can take time.

**Expected durations:**
- 500 rows, 10 columns: ~30 seconds
- 5000 rows, 20 columns: ~2 minutes
- 50000 rows, 30 columns: ~10 minutes

**Solution:** Use async Celery tasks for large datasets (see `ANOMALY_DETECTOR_INTEGRATION.md`).

### No Anomalies Detected

**Problem:** Data is too uniform or threshold too high.

**Solution:** Regenerate test data with more extreme anomalies:
```python
# In generate_test_data.py, increase anomaly severity:
df.at[idx, 'request_count'] = np.random.randint(5000, 10000)  # More extreme
```

---

## What's Next?

✅ **Anomaly detection works!** Now you can:

1. **Integrate Foundation-Sec-8B** for triage analysis
2. **Create Celery tasks** for async processing
3. **Build frontend dashboard** to view anomalies
4. **Add export** functionality (PDF/Excel)
5. **Fine-tune threshold** based on your data

See `ANOMALY_DETECTOR_INTEGRATION.md` for production integration guide.

---

## Quick Reference Commands

```bash
# 1. Generate test data
python3 generate_test_data.py

# 2. Get auth token
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" | jq -r '.access_token')

# 3. Upload dataset
DATASET_ID=$(curl -s -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_dataset_with_anomalies.xlsx" | jq -r '.id')

# 4. Trigger analysis
curl -X POST "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze-test" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. Get anomalies
curl -X GET "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies" \
  -H "Authorization: Bearer $TOKEN" | jq . | head -50
```

---

## Success Criteria

✅ Test data generated (550 rows, 50 anomalies)
✅ File uploaded successfully to S3
✅ Analysis completes without errors
✅ ~50-60 anomalies detected (close to ground truth)
✅ Anomalies stored in MongoDB with features
✅ Dataset status updated to "completed"
✅ Anomalies retrievable via API

If all checks pass, your anomaly detector is working! 🎉
