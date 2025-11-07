# Testing with BETH CSV Dataset

Now that STARAI supports both `.xlsx` and `.csv` files, you can directly upload the BETH dataset!

---

## 📊 What's Different Now?

### **Before:** (CSV not supported)
```
BETH CSV → prepare_beth_dataset.py → Convert to Excel → Upload
```

### **After:** (CSV supported! ✅)
```
BETH CSV → Upload directly to STARAI
```

**No conversion needed!** Just upload the CSV file directly.

---

## 🚀 Quick Test with BETH Dataset

### Option 1: Test with Full Dataset (189K rows - takes ~5-10 minutes)

```bash
# 1. Rebuild containers (to apply changes)
docker-compose up --build -d backend frontend

# 2. Wait for services to start
sleep 10

# 3. Login
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" | jq -r '.access_token')

# 4. Upload BETH CSV directly (55MB file)
UPLOAD_RESPONSE=$(curl -s -X POST \
  "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Model/Beta dataset/labelled_testing_data.csv")

echo "$UPLOAD_RESPONSE" | jq .

DATASET_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.id')
echo "Dataset ID: $DATASET_ID"

# 5. Trigger analysis (this will take 5-10 minutes for 189K rows)
echo "Starting analysis... (this will take ~5-10 minutes)"
curl -X POST \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze-test" \
  -H "Authorization: Bearer $TOKEN" \
  | jq .

# 6. View detected anomalies
curl -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[0:5]'  # Show first 5 anomalies
```

### Option 2: Test with Sample (5K rows - takes ~30-60 seconds)

First, create a smaller sample for faster testing:

```bash
# Create a sampled CSV (5000 rows)
python3 -c "
import pandas as pd
df = pd.read_csv('Model/Beta dataset/labelled_testing_data.csv', nrows=5000)
df.to_csv('beth_sample_5k.csv', index=False)
print(f'Created beth_sample_5k.csv with {len(df)} rows')
print(f'Evil samples: {df[\"evil\"].sum()} ({df[\"evil\"].mean()*100:.2f}%)')
"

# Now upload and test
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" | jq -r '.access_token')

DATASET_ID=$(curl -s -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@beth_sample_5k.csv" | jq -r '.id')

echo "Analyzing dataset: $DATASET_ID"
curl -X POST \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze-test" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## 🎯 What Changed?

### Backend (`backend/app/tools/excel_parser.py`)
- ✅ Now accepts both `.xlsx` and `.csv` files
- ✅ Auto-detects file type from extension
- ✅ Handles UTF-8 and latin-1 encoding for CSVs
- ✅ Converts CSV to same internal format as Excel (single "sheet")

### Frontend (`frontend/src/pages/HomePage/HomePage.jsx`)
- ✅ Updated file upload to accept `.xlsx,.csv`
- ✅ Updated validation messages
- ✅ Updated UI text to mention both formats

### Validation
- ✅ Accepts MIME types: `text/csv`, `text/plain`, `application/csv`
- ✅ Falls back gracefully if MIME type is unexpected

---

## 📝 CSV vs Excel Format

Both formats work identically:

| Feature | CSV | Excel |
|---------|-----|-------|
| Upload | ✅ | ✅ |
| Parsing | ✅ | ✅ |
| Anomaly Detection | ✅ | ✅ |
| Analysis Speed | Same | Same |
| Multi-sheet | No (single sheet) | Yes (multiple sheets) |

**Note:** CSV files are treated as having a single sheet named "Sheet1".

---

## 🧪 Testing CSV Upload

### Via Frontend (Easiest):

1. Open `http://localhost:3000`
2. Login
3. Drag & drop `labelled_testing_data.csv` or `beth_sample_5k.csv`
4. Wait for upload confirmation
5. Click "View" on the dataset
6. Trigger analysis

### Via API:

```bash
# Upload CSV
curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@your_file.csv"

# Trigger analysis
curl -X POST "http://localhost:8000/api/anomaly/datasets/{dataset_id}/analyze-test" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔍 BETH Dataset Analysis

When you analyze the BETH dataset, you'll get:

**Ground Truth Labels:**
- `evil` column = 1 → Malicious system call sequence
- `evil` column = 0 → Benign system call sequence

**What the Autoencoder Detects:**
- Rows with unusual patterns across features
- High reconstruction error = anomaly
- Should correlate with `evil=1` but not 100% (it's unsupervised)

**Expected Results** (for 5000 row sample):
- Evil rows (ground truth): ~50-100 (1-2%)
- Detected anomalies: ~250 (top 5%)
- **Note:** Autoencoder will detect more than just the labeled "evil" samples because it finds ANY unusual pattern

---

## ⚡ Performance Expectations

| Dataset Size | Upload Time | Analysis Time | Total Time |
|--------------|-------------|---------------|------------|
| 1K rows | ~1 sec | ~15 sec | ~20 sec |
| 5K rows | ~2 sec | ~45 sec | ~1 min |
| 50K rows | ~10 sec | ~5 min | ~5.5 min |
| 189K rows (full BETH) | ~30 sec | ~10 min | ~10.5 min |

**Note:** Analysis time depends on CPU. With GPU: ~50% faster.

---

## 🐛 Troubleshooting

### Error: "File is empty"
**Cause:** CSV has no data or only headers
**Fix:** Check CSV has at least 1 data row

### Error: "Failed to parse file"
**Cause:** CSV is corrupted or has encoding issues
**Fix:** Try opening in Excel and re-saving as CSV UTF-8

### Analysis takes too long
**Cause:** Large dataset (>50K rows)
**Solution:** Sample the data first:
```python
import pandas as pd
df = pd.read_csv('large_file.csv', nrows=10000)
df.to_csv('sample.csv', index=False)
```

### Frontend doesn't accept CSV
**Cause:** Frontend not rebuilt
**Fix:**
```bash
docker-compose up --build -d frontend
```

---

## ✅ Quick Verification

Test that CSV support works:

```bash
# 1. Rebuild
docker-compose up --build -d backend frontend

# 2. Create a tiny test CSV
echo "name,value,category
alice,100,A
bob,200,B
charlie,50,A
dave,9999,C
eve,150,B" > tiny_test.csv

# 3. Upload
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" | jq -r '.access_token')

curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@tiny_test.csv" | jq .
```

**Expected:** Upload succeeds, returns dataset ID. The row with `value=9999` should be detected as an anomaly.

---

## 🎉 Summary

✅ **No more CSV → Excel conversion needed!**
✅ **Upload BETH dataset directly**
✅ **Same anomaly detection for both formats**
✅ **Ready to test with real cybersecurity data**

Now you can upload `Model/Beta dataset/labelled_testing_data.csv` directly to STARAI! 🚀
