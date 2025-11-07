# CSV Support Added ✅

## Summary of Changes

STARAI now supports **both `.xlsx` and `.csv` files** for dataset uploads. You can now directly upload the BETH dataset without conversion!

---

## 🎯 The Problem You Identified

**Before:**
- System only accepted `.xlsx` files
- To test with BETH dataset (`labelled_testing_data.csv`), you'd need to:
  1. Run `prepare_beth_dataset.py` to convert CSV → Excel
  2. Upload the Excel file
  3. Unnecessary conversion step

**After:**
- System accepts **both `.xlsx` and `.csv`** files
- Upload BETH CSV directly - no conversion needed!

---

## 📝 What Changed

### 1. **Backend Parser** (`backend/app/tools/excel_parser.py`)

**Updated Functions:**

#### `parse_xlsx_to_json()` - Now handles CSV
```python
# Auto-detects file type from extension
is_csv = filename.lower().endswith('.csv')

if is_csv:
    # Parse CSV with UTF-8/latin-1 fallback
    df = pd.read_csv(StringIO(text_content))
    # Treat as single sheet named "Sheet1"
else:
    # Parse Excel with openpyxl
    excel_file = pd.ExcelFile(...)
```

**Features:**
- ✅ Auto-detects `.csv` vs `.xlsx`
- ✅ Handles UTF-8 and latin-1 encoding
- ✅ CSV treated as single sheet
- ✅ Same output format for both types

#### `validate_xlsx_file()` - Validates both formats
```python
# Now accepts both extensions
is_xlsx = filename.lower().endswith('.xlsx')
is_csv = filename.lower().endswith('.csv')

if not (is_xlsx or is_csv):
    raise ValueError("Only .xlsx and .csv files supported")
```

**MIME Types Accepted:**
- **Excel:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/octet-stream`
- **CSV:** `text/csv`, `text/plain`, `application/csv`, `application/octet-stream`

---

### 2. **Frontend Updates** (`frontend/src/pages/HomePage/HomePage.jsx`)

#### Upload Validation
```javascript
// Before: Only .xlsx
if (!file.name.toLowerCase().endsWith('.xlsx'))

// After: Both .xlsx and .csv
const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
const isCsv = file.name.toLowerCase().endsWith('.csv');

if (!isXlsx && !isCsv) {
  message.error('Only .xlsx and .csv files are supported');
}
```

#### File Input Accept
```javascript
// Before
accept: ".xlsx"

// After
accept: ".xlsx,.csv"
```

#### UI Text Updates
- "Upload .xlsx datasets" → "Upload .xlsx or .csv datasets"
- "Only Excel .xlsx files" → "Excel (.xlsx) and CSV (.csv) files supported"

---

## 🚀 How to Use

### Via Frontend (Drag & Drop)

1. Open `http://localhost:3000`
2. Login
3. **Drag & drop your CSV file** (or Excel file)
4. System automatically detects format and parses correctly

### Via API

```bash
# Both work the same way
curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@your_file.csv"

curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@your_file.xlsx"
```

---

## 📊 Testing with BETH Dataset

You can now directly upload the real BETH cybersecurity dataset!

### Quick Test (5000 rows)

```bash
# 1. Create sample
python3 -c "
import pandas as pd
df = pd.read_csv('Model/Beta dataset/labelled_testing_data.csv', nrows=5000)
df.to_csv('beth_sample_5k.csv', index=False)
print(f'Created: {len(df)} rows, {df[\"evil\"].sum()} anomalies')
"

# 2. Login
TOKEN=$(curl -s -X POST "http://localhost:8000/api/auth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=password123" | jq -r '.access_token')

# 3. Upload CSV directly
DATASET_ID=$(curl -s -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@beth_sample_5k.csv" | jq -r '.id')

# 4. Analyze
curl -X POST \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/analyze-test" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 5. View results
curl -X GET \
  "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/anomalies" \
  -H "Authorization: Bearer $TOKEN" | jq '.[0:5]'
```

### Full Dataset (189K rows)

```bash
# Upload full BETH dataset (takes ~10 minutes to analyze)
curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@Model/Beta dataset/labelled_testing_data.csv" \
  | jq .
```

---

## 🔍 CSV vs Excel Comparison

| Feature | CSV | Excel |
|---------|-----|-------|
| **Upload** | ✅ Supported | ✅ Supported |
| **Parsing** | Via pandas `read_csv` | Via pandas `ExcelFile` |
| **Encoding** | UTF-8 (fallback: latin-1) | N/A |
| **Multiple Sheets** | No (single "Sheet1") | Yes (all sheets parsed) |
| **Anomaly Detection** | ✅ Same algorithm | ✅ Same algorithm |
| **Speed** | Slightly faster (simpler format) | Slightly slower |
| **File Size** | Smaller (text format) | Larger (binary format) |
| **Best For** | Log files, exports, BETH | Structured reports, multiple sheets |

---

## ✅ What Was Tested

### Verified Working:
- ✅ CSV upload via frontend
- ✅ CSV upload via API
- ✅ Excel upload (still works)
- ✅ CSV parsing with UTF-8
- ✅ CSV parsing with latin-1 fallback
- ✅ Both formats produce same internal structure
- ✅ Anomaly detection works on CSV data
- ✅ Frontend validation accepts both formats

### Edge Cases Handled:
- ✅ CSV with UTF-8 encoding
- ✅ CSV with non-UTF-8 encoding (latin-1 fallback)
- ✅ Empty CSV files (error message)
- ✅ CSV with no data rows (error message)
- ✅ Incorrect MIME types (logged warning, still processes if extension correct)

---

## 📁 Files Modified

1. **`backend/app/tools/excel_parser.py`**
   - Updated `parse_xlsx_to_json()` to handle CSV
   - Updated `validate_xlsx_file()` to accept CSV
   - Added CSV MIME type validation

2. **`frontend/src/pages/HomePage/HomePage.jsx`**
   - Updated file validation
   - Updated `accept` attribute to `.xlsx,.csv`
   - Updated UI text to mention both formats

3. **`frontend/src/pages/HomePage/HomePage.jsx` (upload component)**
   - Changed accept attribute from `.xlsx` to `.xlsx,.csv`

---

## 🔧 No Changes Needed For:

- ✅ **Anomaly detector** - Already works with pandas DataFrames (file type agnostic)
- ✅ **Database models** - Store parsed data, not raw files
- ✅ **S3 storage** - Stores any file type
- ✅ **API routes** - Already generic enough to handle both

---

## 📖 Documentation Created

1. **`TEST_WITH_BETH_CSV.md`** - Complete guide for testing with BETH dataset
2. **`CSV_SUPPORT_SUMMARY.md`** - This document

---

## 🚀 Ready to Test!

The containers have been rebuilt. You can now:

1. **Upload BETH CSV directly** - No conversion needed!
   ```bash
   # Via frontend: Just drag & drop labelled_testing_data.csv
   # Via API: See commands above
   ```

2. **Test with synthetic data**
   ```bash
   ./test_anomaly_detection.sh  # Still works with Excel
   ```

3. **Create CSV test file**
   ```bash
   echo "name,value,category
   alice,100,A
   bob,200,B
   charlie,9999,C" > test.csv

   # Upload test.csv - "charlie" should be detected as anomaly
   ```

---

## 🎉 Benefits

✅ **No more CSV → Excel conversion**
✅ **Direct BETH dataset testing**
✅ **Faster workflow** (skip conversion step)
✅ **Smaller uploads** (CSV files are smaller than Excel)
✅ **Same anomaly detection** for both formats
✅ **Backward compatible** (Excel still works)

---

## Next Steps

1. **Test CSV upload** with BETH dataset
2. **Compare results** with ground truth (`evil` column)
3. **Tune threshold** based on real data performance
4. **Integrate Foundation-Sec-8B** for triage analysis

See `TEST_WITH_BETH_CSV.md` for detailed testing instructions! 🚀
