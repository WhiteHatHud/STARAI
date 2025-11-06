# Backend Changes Summary - Excel Only Upload

## Overview
Transformed the backend to accept **ONLY .xlsx files** with deterministic JSON parsing. All AI/OCR processing has been completely removed.

---

## 🎯 What Changed

### ✅ New Files Created

1. **`backend/app/tools/excel_parser.py`** (NEW)
   - Parses .xlsx files using `pandas` + `openpyxl`
   - Returns standardized JSON schema
   - Validates file type and handles errors
   - Functions:
     - `parse_xlsx_to_json()` - Main parser
     - `validate_xlsx_file()` - Type validation
     - `get_excel_summary()` - Human-readable summary

### ✅ Modified Files

2. **`backend/app/tools/main.py`** (REPLACED)
   - **Before**: Handled PDF, DOCX, images, audio, video with AI/OCR
   - **After**: Only handles .xlsx with deterministic parsing
   - Returns structured JSON, not text
   - 415 error for non-.xlsx files
   - 413 error for files > 25MB

3. **`backend/app/routes/document_routes.py`** (UPDATED)
   - Added file type validation in upload endpoint
   - Rejects non-.xlsx files immediately with 415 error
   - Updated messages to reflect Excel-only processing

4. **`backend/app/tasks/document_tasks.py`** (UPDATED)
   - Updated to call `process_file()` with new parameters
   - Stores parsed JSON data in `content` field
   - Stores full structured data in `parsed_data` field
   - Skips text chunking (not needed for structured Excel)

5. **`backend/app/repositories/document_repo.py`** (UPDATED)
   - Passes `content_type` to processing task
   - No other logic changes

6. **`backend/requirements.txt`** (CLEANED UP)
   - **Removed**: `Pillow`, `moviepy`, `pypandoc_binary`, `pdf2docx`, `PyMuPDF`, `pydub`
   - **Kept**: `openpyxl`, `pandas` (for Excel parsing)

7. **`backend/.env.local`** (CLEANED UP)
   - **Removed**: All Sagemaker variables (SAGEMAKER_*, QWEN3_*)
   - **Removed**: `GPU_USAGE` variable
   - **Kept**: AWS S3, Redis, JWT variables

### 🗑️ Deleted Files

8. **AI/OCR Processing Files** (DELETED)
   - `backend/app/tools/marker.py` ❌
   - `backend/app/tools/images.py` ❌
   - `backend/app/tools/whisper.py` ❌
   - `backend/app/tools/video.py` ❌
   - `backend/app/tools/docling.py` ❌

---

## 📊 JSON Schema (Output)

All Excel uploads now return this standardized structure:

```json
{
  "workbookMeta": {
    "sheetNames": ["Sheet1", "Sheet2"],
    "sheetCount": 2,
    "totalRows": 150
  },
  "sheets": [
    {
      "name": "Sheet1",
      "rows": [
        { "ColumnA": "value1", "ColumnB": 42, "ColumnC": null },
        { "ColumnA": "value2", "ColumnB": 100, "ColumnC": "test" }
      ],
      "rowCount": 2,
      "columnCount": 3
    }
  ],
  "sourceFile": {
    "filename": "report.xlsx",
    "size": 123456,
    "uploadedAt": "2025-11-06T00:01:23Z",
    "fileType": "xlsx"
  }
}
```

This data is stored in MongoDB under:
- `content` field: JSON string (for backward compatibility)
- `parsed_data` field: Full structured object (easy access)
- `content_type` field: "excel"

---

## 🧪 How to Test Backend Changes

### Prerequisites
```bash
cd /home/hud/github/STARAI/backend
pip install -r requirements.txt
```

### Step 1: Start Backend Services

**Terminal 1 - Redis:**
```bash
redis-server
```

**Terminal 2 - Celery Worker:**
```bash
cd /home/hud/github/STARAI/backend
celery -A app.core.celery_manager worker --loglevel=info
```

**Terminal 3 - FastAPI Server:**
```bash
cd /home/hud/github/STARAI/backend
uvicorn app.main:app --reload --port 8000
```

### Step 2: Test Upload Endpoints

#### ✅ Test 1: Valid .xlsx Upload (Should Succeed)

Create a test Excel file or use an existing one.

```bash
# Using curl to test upload
curl -X POST "http://localhost:8000/cases/{CASE_ID}/documents/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/test.xlsx" \
  -F "case_id=YOUR_CASE_ID"
```

**Expected Response:**
```json
{
  "progress_id": "abc-123-def",
  "message": "Document upload started."
}
```

**Expected Log Output:**
- "Starting Excel parsing for: test.xlsx"
- "Successfully parsed Excel file - Sheets: X, Total rows: Y"
- "Document upload task completed successfully"

#### ❌ Test 2: Invalid File Type (Should Fail)

Try uploading a PDF:

```bash
curl -X POST "http://localhost:8000/cases/{CASE_ID}/documents/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/test.pdf" \
  -F "case_id=YOUR_CASE_ID"
```

**Expected Response: 415 Error**
```json
{
  "detail": "Only .xlsx files are supported. PDFs, images, and other formats are not allowed."
}
```

#### ❌ Test 3: Image Upload (Should Fail)

```bash
curl -X POST "http://localhost:8000/cases/{CASE_ID}/documents/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "case_id=YOUR_CASE_ID"
```

**Expected: 415 Error** (same as above)

### Step 3: Verify Database Storage

After successful upload, check MongoDB:

```javascript
// Connect to MongoDB
use your_database;

// Find the uploaded document
db.documents.findOne({name: "test.xlsx"});

// Should see:
// - content: JSON string of parsed data
// - content_type: "excel"
// - parsed_data: Full structured object
// - s3_key: S3 file path
```

### Step 4: Check S3 Storage

Verify the .xlsx file was uploaded to S3:
- Path: `s3bucket-starai-sa4jp/dataset/documents/{case_id}/{doc_id}.xlsx`
- File should be retrievable

### Step 5: Test Progress Tracking

```bash
# Get progress by ID
curl "http://localhost:8000/reports/progress/by-id/{PROGRESS_ID}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Progress Messages:**
1. "Starting upload of Excel file..." (0%)
2. "Parsing Excel file..." (5%)
3. "Storing document..." (10%)
4. "Processing document..." (30%)
5. "Finalizing document..." (70%)
6. "Document uploaded successfully!" (100%)

---

## 🔍 What to Look For During Testing

### ✅ Success Indicators:
- [ ] Only .xlsx files are accepted
- [ ] Other file types return 415 errors immediately
- [ ] Excel files parse to JSON correctly
- [ ] All sheets in workbook are captured
- [ ] Data is stored in MongoDB with `parsed_data` field
- [ ] Files are uploaded to S3
- [ ] Progress tracking works end-to-end
- [ ] No errors about missing modules (marker, images, etc.)

### ❌ Failure Indicators:
- [ ] Server crashes on startup (missing dependencies)
- [ ] Import errors for deleted files
- [ ] .xlsx files are rejected
- [ ] Other file types are accepted
- [ ] Parsing fails on valid Excel files
- [ ] Data is not stored correctly

---

## 🐛 Common Issues & Solutions

### Issue 1: Import Errors
**Error:** `ModuleNotFoundError: No module named 'app.tools.marker'`
**Solution:** The old tools are deleted. Make sure you're running from the STARAI directory, not STARAI-2025.

### Issue 2: Missing Dependencies
**Error:** `ModuleNotFoundError: No module named 'openpyxl'`
**Solution:** Run `pip install -r requirements.txt` again.

### Issue 3: S3 Upload Fails
**Error:** AWS credentials error
**Solution:** Verify AWS keys in `.env.local` are correct and have S3 write permissions.

### Issue 4: Redis Connection Error
**Error:** `ConnectionError: Error connecting to Redis`
**Solution:** Make sure Redis is running: `redis-server`

### Issue 5: Celery Worker Not Processing
**Error:** Tasks stuck in "initializing"
**Solution:**
1. Check Celery worker is running
2. Check Redis connection
3. Restart Celery worker

---

## 📝 API Changes

### Changed Endpoints:

#### `POST /cases/{case_id}/documents/`
**Before:**
- Accepted: PDF, DOCX, PPTX, images, audio, video, CSV, TXT
- Returned: Text content

**After:**
- Accepts: **ONLY .xlsx**
- Returns: Structured JSON
- **Breaking Change:** All other file types now return 415 error

---

## 🚀 Next Steps (After Backend Testing)

Once you verify the backend works correctly:
1. ✅ Upload a valid .xlsx file and confirm it parses
2. ✅ Try uploading a PDF/image and confirm it's rejected
3. ✅ Check MongoDB to see structured data
4. ✅ Verify no import/dependency errors

**Then notify me and I'll proceed with:**
- Frontend: Simplified 2-column landing page
- Frontend: Update upload UI to only accept .xlsx
- Frontend: Remove all AI/PDF/Image UI references
- Documentation: Final README update

---

## 💾 Files to Review Before Testing

Key files to verify are correct:
1. `/home/hud/github/STARAI/backend/app/tools/main.py`
2. `/home/hud/github/STARAI/backend/app/tools/excel_parser.py`
3. `/home/hud/github/STARAI/backend/app/tasks/document_tasks.py`
4. `/home/hud/github/STARAI/backend/requirements.txt`
5. `/home/hud/github/STARAI/backend/.env.local`

---

## ⚠️ Important Notes

1. **Breaking Change:** This is a **major breaking change**. Any existing code or users expecting to upload PDFs/images will fail.

2. **Data Migration:** Existing documents in the database with `content_type != "excel"` will still work, but you cannot upload new ones.

3. **Frontend:** The current frontend still shows UI for all file types. It will allow users to try uploading them, but the backend will reject them. **Frontend changes are pending.**

4. **No Rollback:** The AI/OCR tool files are deleted. To rollback, you'd need to restore from the original STARAI-2025 directory.

---

## 📞 Need Help?

If you encounter issues during testing, provide:
1. Error message (full traceback)
2. Which test case failed
3. Logs from backend/Celery
4. What you were trying to upload

Good luck with testing! Let me know when you're ready for frontend changes. 🎉
