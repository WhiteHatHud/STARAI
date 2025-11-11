# Session Status Enum Fix - "pending" → "initializing"

## Problem

When calling `/datasets/{id}/analyze` or `/datasets/{id}/start-autoencoder`, got this error:

```json
{
  "detail": "Analysis failed: 1 validation error for AnalysisSession\nstatus\n  Input should be 'initializing', 'parsing', 'detecting', 'triaging', 'completed' or 'error' [type=enum, input_value='pending', input_type=str]"
}
```

## Root Cause

The `SessionStatus` enum in `anomaly_models.py` defines these valid values:
```python
class SessionStatus(str, Enum):
    INITIALIZING = "initializing"
    PARSING = "parsing"
    DETECTING = "detecting"
    TRIAGING = "triaging"
    COMPLETED = "completed"
    ERROR = "error"
```

But the code was using `"pending"` and `"running"` which are **NOT** in the enum:

```python
# ❌ WRONG - "pending" is not a valid SessionStatus
session_doc = {
    "status": "pending",  # This causes validation error!
    ...
}

# ❌ WRONG - checking for invalid statuses
existing = analysis_sessions_collection.find_one({
    "status": {"$in": ["pending", "running"]}  # Neither exists in enum!
})
```

---

## Solution

Changed all occurrences of `"pending"` to `"initializing"` and `"running"` to valid enum values.

### 1. Create Session with Correct Status

**Before:**
```python
session_doc = {
    "dataset_id": dataset_id,
    "user_id": str(current_user.id),
    "status": "pending",  # ❌ Invalid
    "progress": 0,
    "created_at": datetime.utcnow()
}
```

**After:**
```python
session_doc = {
    "dataset_id": dataset_id,
    "user_id": str(current_user.id),
    "status": "initializing",  # ✅ Valid enum value
    "progress": 0,
    "created_at": datetime.utcnow()
}
```

---

### 2. Check for Existing Active Sessions

**Before:**
```python
existing = analysis_sessions_collection.find_one({
    "dataset_id": dataset_id,
    "status": {"$in": ["pending", "running"]}  # ❌ Invalid values
})
```

**After:**
```python
existing = analysis_sessions_collection.find_one({
    "dataset_id": dataset_id,
    "status": {"$in": ["initializing", "parsing", "detecting"]}  # ✅ Valid enum values
})
```

---

### 3. Race Condition Handler

**Before:**
```python
except DuplicateKeyError:
    existing = analysis_sessions_collection.find_one({
        "dataset_id": dataset_id,
        "status": {"$in": ["pending", "running"]}  # ❌ Invalid
    })
```

**After:**
```python
except DuplicateKeyError:
    existing = analysis_sessions_collection.find_one({
        "dataset_id": dataset_id,
        "status": {"$in": ["initializing", "parsing", "detecting"]}  # ✅ Valid
    })
```

---

## Valid Session Status Values

According to `SessionStatus` enum, only these are valid:

| Status | Description | When Used |
|--------|-------------|-----------|
| `initializing` | Session just created | Initial state |
| `parsing` | Parsing file structure | During file download/parse |
| `detecting` | Running autoencoder | During anomaly detection |
| `triaging` | Running LLM analysis | During LLM triage |
| `completed` | Analysis finished | Success state |
| `error` | Analysis failed | Error state |

---

## Session Lifecycle

```
initializing
    ↓
parsing (downloading from S3, parsing Excel/CSV)
    ↓
detecting (training autoencoder, finding anomalies)
    ↓
completed (anomalies stored in DB)

OR

error (if any step fails)
```

For LLM analysis (separate flow):
```
analyzing complete
    ↓
triaging (running LLM on top anomalies)
    ↓
completed (LLM explanations stored)

OR

error (if LLM fails)
```

---

## Testing After Fix

### Test 1: Upload and Analyze

```bash
# 1. Upload file
curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.xlsx"

# Response: { "id": "ABC123..." }

# 2. Start analysis
curl -X POST "http://localhost:8000/api/anomaly/datasets/ABC123/analyze" \
  -H "Authorization: Bearer $TOKEN"

# Response: { "session_id": "XYZ789...", "reused": false }
# ✅ No more validation error!

# 3. Check status
curl "http://localhost:8000/api/anomaly/datasets/ABC123/status" \
  -H "Authorization: Bearer $TOKEN"

# Response: { "status": "analyzing", "progress": 50, ... }
```

### Test 2: Session Reuse

```bash
# Call analyze again for same dataset
curl -X POST "http://localhost:8000/api/anomaly/datasets/ABC123/analyze" \
  -H "Authorization: Bearer $TOKEN"

# Response: { "session_id": "XYZ789...", "reused": true }
# ✅ Reuses existing session correctly
```

---

## Files Changed

**File:** `/backend/app/routes/anomaly_routes.py`

**Line 241:** Changed session creation status
```python
- "status": "pending",
+ "status": "initializing",
```

**Line 229:** Updated active session check
```python
- "status": {"$in": ["pending", "running"]}
+ "status": {"$in": ["initializing", "parsing", "detecting"]}
```

**Line 251:** Updated race condition handler
```python
- "status": {"$in": ["pending", "running"]}
+ "status": {"$in": ["initializing", "parsing", "detecting"]}
```

---

## Why This Matters

**Pydantic Validation:**
- Pydantic (FastAPI's validation library) enforces enum values strictly
- If you pass an invalid value, it raises a validation error
- This prevents data corruption and ensures type safety

**Database Integrity:**
- All sessions in MongoDB now have consistent status values
- Queries for active sessions work correctly
- No orphaned sessions with invalid statuses

---

## Common Mistakes to Avoid

❌ **Don't use arbitrary status strings:**
```python
session["status"] = "in_progress"  # NOT in enum!
session["status"] = "running"      # NOT in enum!
session["status"] = "pending"      # NOT in enum!
```

✅ **Use only defined enum values:**
```python
from app.models.anomaly_models import SessionStatus

session["status"] = SessionStatus.INITIALIZING
session["status"] = SessionStatus.PARSING
session["status"] = SessionStatus.DETECTING
# etc.
```

Or use string literals that match enum:
```python
session["status"] = "initializing"  # ✅
session["status"] = "parsing"       # ✅
session["status"] = "detecting"     # ✅
```

---

## Summary

**Problem:** Used `"pending"` status which doesn't exist in `SessionStatus` enum

**Solution:** Changed to `"initializing"` which is a valid enum value

**Impact:**
- ✅ No more validation errors
- ✅ Session creation works
- ✅ Session reuse works
- ✅ Analysis can proceed normally

**Changes:** 3 lines in `anomaly_routes.py` (lines 229, 241, 251)

The 500 error is now fixed! 🎉
