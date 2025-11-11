# API Contract - Fixed 404 Endpoints

## Problem Fixed

The frontend was calling endpoints that didn't exist:
- ❌ `GET /api/anomaly/datasets/:id/session` → **404**
- ❌ `POST /api/anomaly/datasets/:id/analyze-test` → **404**

## New Working Contract

### Backend Endpoints

#### 1. Upload Dataset (No Change)
```
POST /api/anomaly/datasets/upload
```

**What it does:**
- Saves file to S3
- Creates dataset record in MongoDB
- Sets status to `"uploaded"`
- **Does NOT** start analysis automatically

**Response:**
```json
{
  "_id": "673abc123...",
  "filename": "dataset.xlsx",
  "status": "uploaded",
  "progress": 0
}
```

---

#### 2. Start Analysis (NEW - Replaces `/analyze-test`)
```
POST /api/anomaly/datasets/{dataset_id}/analyze
Status Code: 202 Accepted
```

**What it does:**
- Checks for existing active session (reuses if exists)
- Creates new session if needed
- Kicks off background autoencoder task
- Returns immediately (doesn't wait for completion)

**Response:**
```json
{
  "session_id": "673xyz...",
  "reused": false
}
```

**Background Task:**
- Downloads file from S3
- Trains autoencoder
- Detects anomalies
- Stores anomalies in DB
- Updates dataset status: `"analyzing"` → `"analyzed"`
- Updates progress: 0% → 10% → 30% → 50% → 80% → 100%

---

#### 3. Poll Status (NEW - Replaces `/session`)
```
GET /api/anomaly/datasets/{dataset_id}/status
```

**What it does:**
- Returns current dataset status for polling

**Response:**
```json
{
  "status": "analyzing",
  "progress": 50,
  "error": null,
  "anomaly_count": 0
}
```

**Status Values:**
- `"uploaded"` - Ready to analyze
- `"analyzing"` - Autoencoder running
- `"analyzed"` - Autoencoder complete, ready for LLM
- `"triaging"` - LLM running
- `"completed"` - All done
- `"error"` - Failed

---

### Frontend Implementation

#### Start Analysis
```jsx
const handleAutoencoder = async () => {
  setAnalyzing(true);

  try {
    // Start analysis (returns immediately)
    await axios.post(
      `${API_BASE_URL}/anomaly/datasets/${datasetId}/analyze`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );

    message.success("Analysis started!");

    // Start polling
    pollDatasetStatus();

  } catch (error) {
    message.error("Failed to start analysis");
    setAnalyzing(false);
  }
};
```

#### Poll Status
```jsx
const pollDatasetStatus = () => {
  const interval = setInterval(async () => {
    try {
      const { data } = await axios.get(
        `${API_BASE_URL}/anomaly/datasets/${datasetId}/status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { status, progress, error, anomaly_count } = data;

      // Update UI
      setAnalysisProgress(progress);

      // Check completion
      if (status === "analyzed") {
        clearInterval(interval);
        setAnalyzing(false);
        message.success(`Complete! Found ${anomaly_count} anomalies.`);
        fetchDataset();
        fetchAnomalies();
      } else if (status === "error") {
        clearInterval(interval);
        setAnalyzing(false);
        message.error(error || "Analysis failed");
      }

    } catch (err) {
      console.error("Polling error:", err);
      clearInterval(interval);
    }
  }, 3000); // Poll every 3 seconds

  // Timeout after 10 minutes
  setTimeout(() => clearInterval(interval), 600000);
};
```

---

## Verification Checklist

### Backend
- [ ] Visit `http://localhost:8000/docs`
- [ ] Confirm you see:
  - ✅ `POST /api/anomaly/datasets/upload`
  - ✅ `POST /api/anomaly/datasets/{dataset_id}/analyze`
  - ✅ `GET /api/anomaly/datasets/{dataset_id}/status`
- [ ] No more `/session` or `/analyze-test` endpoints

### Frontend
- [ ] Check browser Network tab
- [ ] Verify requests go to:
  - ✅ `/api/anomaly/datasets/upload` (on file upload)
  - ✅ `/api/anomaly/datasets/{id}/analyze` (on "Start Autoencoder" click)
  - ✅ `/api/anomaly/datasets/{id}/status` (polling every 3s)
- [ ] No requests to `/session` or `/analyze-test`

### Environment Variables
```env
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000/api
```

Make sure it's `/api` not just `:8000` or `:8000/api`

---

## Test Flow

### 1. Upload
```
User uploads file
  ↓
POST /api/anomaly/datasets/upload
  ↓
Response: { status: "uploaded" }
  ↓
Card shows: "Uploaded" with "Start Autoencoder" button
```

### 2. Click "Start Autoencoder"
```
User clicks button
  ↓
POST /api/anomaly/datasets/{id}/analyze
  ↓
Response (immediate): { session_id: "...", reused: false }
  ↓
Background task starts
  ↓
Frontend starts polling every 3s
```

### 3. Polling Loop
```
Every 3 seconds:
  GET /api/anomaly/datasets/{id}/status
    ↓
  Response: { status: "analyzing", progress: 50, ... }
    ↓
  Update progress bar
    ↓
  Check if status === "analyzed"
    ↓
  If yes: stop polling, show success
```

### 4. Complete
```
Status changes to "analyzed"
  ↓
Polling stops
  ↓
Message: "✅ Complete! Found 247 anomalies"
  ↓
Show anomaly table + "Start LLM" button
```

---

## Backend Code Changes

### Added Imports
```python
import asyncio
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
```

### New Endpoint: `/analyze`
```python
@router.post("/datasets/{dataset_id}/analyze", status_code=202)
async def start_analysis(dataset_id: str, current_user: User):
    # Check for existing session
    existing = analysis_sessions_collection.find_one({
        "dataset_id": dataset_id,
        "status": {"$in": ["pending", "running"]}
    })

    if existing:
        return {"session_id": str(existing["_id"]), "reused": True}

    # Create new session
    session_doc = {...}
    result = analysis_sessions_collection.insert_one(session_doc)

    # Update dataset status
    await anomaly_repo.update_dataset(
        dataset_id, {"status": "analyzing", "progress": 0}
    )

    # Start background task
    asyncio.create_task(run_autoencoder_background(dataset_id, user_id))

    return {"session_id": str(result.inserted_id), "reused": False}
```

### Background Task
```python
async def run_autoencoder_background(dataset_id: str, user_id: str):
    try:
        # Download from S3
        await update_dataset(dataset_id, {"progress": 10})

        # Parse file
        await update_dataset(dataset_id, {"progress": 30})

        # Run autoencoder
        await update_dataset(dataset_id, {"progress": 50})
        anomalies, detector = detect_anomalies_in_excel(df, ...)

        # Store anomalies
        await update_dataset(dataset_id, {"progress": 80})
        for anomaly in anomalies:
            await create_anomaly(...)

        # Mark complete
        await update_dataset(dataset_id, {
            "status": "analyzed",
            "progress": 100,
            "anomaly_count": len(anomalies)
        })

    except Exception as e:
        await update_dataset(dataset_id, {
            "status": "error",
            "error": str(e)
        })
```

### New Endpoint: `/status`
```python
@router.get("/datasets/{dataset_id}/status")
async def get_dataset_status(dataset_id: str, current_user: User):
    dataset = await anomaly_repo.get_dataset(dataset_id, current_user)

    return {
        "status": dataset.status,
        "progress": getattr(dataset, 'progress', 0),
        "error": getattr(dataset, 'error', None),
        "anomaly_count": dataset.anomaly_count
    }
```

---

## Model Changes

### DatasetModel
```python
class DatasetModel(BaseModel):
    # ... existing fields ...
    status: DatasetStatus = DatasetStatus.UPLOADED
    anomaly_count: int = 0
    progress: int = 0  # NEW - for polling
    error: Optional[str] = None  # NEW - error message
```

---

## What Was Removed

### Old Endpoints (Removed/Replaced)
- ❌ `GET /api/anomaly/datasets/{id}/session` → Use `/status` instead
- ❌ `POST /api/anomaly/datasets/{id}/analyze-test` → Use `/analyze` instead
- ⚠️ `POST /api/anomaly/datasets/{id}/start-autoencoder` → Still exists but prefer `/analyze`

---

## Troubleshooting

### Issue: Still getting 404
**Check:**
1. Backend is running on port 8000
2. `VITE_API_BASE_URL=http://localhost:8000/api` (not `:8000`)
3. Router is registered in `main.py`
4. CORS allows your frontend origin

### Issue: Analysis starts but never completes
**Check:**
1. Backend logs for errors in background task
2. TensorFlow is installed (`pip install tensorflow`)
3. S3 credentials are correct
4. Dataset file exists in S3

### Issue: Progress stays at 0%
**Check:**
1. Background task is actually running (check logs)
2. `await update_dataset()` calls are working
3. Polling is calling `/status` not `/session`

---

## Quick Test Script

```bash
# 1. Upload
curl -X POST http://localhost:8000/api/anomaly/datasets/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.xlsx"

# Response: { "_id": "673abc...", "status": "uploaded" }

# 2. Start analysis
curl -X POST http://localhost:8000/api/anomaly/datasets/673abc.../analyze \
  -H "Authorization: Bearer $TOKEN"

# Response: { "session_id": "...", "reused": false }

# 3. Poll status (repeat every 3s)
curl http://localhost:8000/api/anomaly/datasets/673abc.../status \
  -H "Authorization: Bearer $TOKEN"

# Response: { "status": "analyzing", "progress": 50, ... }
# Eventually: { "status": "analyzed", "progress": 100, "anomaly_count": 247 }
```

---

## Summary

| Old | New | Status |
|-----|-----|--------|
| `POST /datasets/{id}/analyze-test` | `POST /datasets/{id}/analyze` | ✅ Fixed |
| `GET /datasets/{id}/session` | `GET /datasets/{id}/status` | ✅ Fixed |
| Synchronous blocking | Async background task + polling | ✅ Better UX |
| No progress updates | Real progress (10% → 30% → 50% → 100%) | ✅ Better visibility |

The 404 errors are now fixed! The frontend calls endpoints that actually exist, and the workflow is much smoother with background processing and real-time progress updates.
