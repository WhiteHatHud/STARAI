# Bug Fix: Dataset "Disappearing" Issue

## Problem Summary

Datasets appeared to "disappear" immediately after being created:
- Upload succeeds and returns dataset ID
- Dataset verified to exist in database
- 8 seconds later, `analyze-test` endpoint reports "Dataset not found" (404 error)

## Root Cause

The issue was **NOT** that datasets were being deleted or disappearing. The datasets were persisting correctly in MongoDB Atlas. The problem was a **data type mismatch** in how ObjectIds were being stored and queried.

### Technical Details

1. **PyObjectId Definition** (anomaly_models.py line 30):
   ```python
   PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]
   ```
   - `PyObjectId` is defined as a **string type**, not an ObjectId

2. **Insertion Issue** (anomaly_repo.py):
   ```python
   dataset_dict = dataset.model_dump(by_alias=True)
   result = datasets_collection.insert_one(dataset_dict)
   ```
   - When `model_dump(by_alias=True)` is called, the `_id` field is dumped as a **string** (e.g., `"6911960680c2ac702ba42db5"`)
   - MongoDB stored this as a string, not as `ObjectId("6911960680c2ac702ba42db5")`

3. **Query Issue** (anomaly_repo.py line 82):
   ```python
   query = {"_id": ObjectId(dataset_id)}  # Queries with ObjectId type
   dataset_doc = datasets_collection.find_one(query)  # Returns None
   ```
   - The query was looking for an ObjectId
   - But MongoDB had stored it as a string
   - Result: **No match found** → 404 error

## Verification

I confirmed this by querying MongoDB Atlas directly:

```python
# Query with ObjectId (as the code does)
result = db.datasets.find_one({'_id': ObjectId('6911960680c2ac702ba42db5')})
# Result: NOT FOUND ❌

# Query with string (what's actually in the database)
result = db.datasets.find_one({'_id': '6911960680c2ac702ba42db5'})
# Result: FOUND ✅
```

The `_id` field type in the database was `<class 'str'>` instead of `<class 'bson.objectid.ObjectId'>`.

## Solution

### 1. Fixed All Create Functions

Updated all repository create functions to convert `_id` from string to ObjectId before insertion:

**Files Modified:**
- `/backend/app/repositories/anomaly_repo.py`

**Functions Fixed:**
- `create_dataset()`
- `create_anomaly()`
- `create_anomaly_report()`
- `create_analysis_session()`
- `create_llm_explanation()`

**Code Pattern Applied:**
```python
dataset_dict = dataset.model_dump(by_alias=True)

# CRITICAL FIX: Convert _id from string to ObjectId for MongoDB
if "_id" in dataset_dict and isinstance(dataset_dict["_id"], str):
    dataset_dict["_id"] = ObjectId(dataset_dict["_id"])

result = datasets_collection.insert_one(dataset_dict)
```

### 2. Created Migration Script

**File:** `/backend/migrate_objectids.py`

This script converts existing documents with string `_id` values to proper ObjectId values:

```bash
docker cp backend/migrate_objectids.py starai_backend:/app/
docker-compose exec backend python /app/migrate_objectids.py
```

**Migration Results:**
- Datasets collection: 2 documents fixed ✅
- Anomalies collection: 0 documents (none existed yet)
- Anomaly reports: 0 documents
- Analysis sessions: 0 documents
- LLM explanations: 0 documents

### 3. Verification

After the fix and migration:

```python
# Query with ObjectId now works correctly
result = db.datasets.find_one({'_id': ObjectId('6911960680c2ac702ba42db5')})
# Result: FOUND ✅
# Type: <class 'bson.objectid.ObjectId'> ✅
```

## Testing Recommendations

1. **Test Upload Flow:**
   - Upload a new CSV/XLSX file
   - Verify the dataset ID is returned
   - Immediately trigger analyze-test
   - Should complete successfully (no 404 error)

2. **Verify Existing Data:**
   - The two existing datasets should now be queryable
   - Try running analyze-test on the existing dataset `6911960680c2ac702ba42db5`

3. **Check All Collections:**
   ```python
   # Run this to verify all _id fields are ObjectId
   for coll in ['datasets', 'anomalies', 'analysis_sessions', 'llm_explanations']:
       doc = db[coll].find_one({})
       if doc:
           print(f"{coll}: _id type = {type(doc['_id'])}")
   ```

## Additional Findings

### Environment Configuration

The application is configured to use **MongoDB Atlas** (cloud), not the local Docker MongoDB container:

- `.env.local`: `APP_ENV="production"`
- Connection: `mongodb+srv://starai_user:...@starai-cluster.ltossgo.mongodb.net/`
- Database: `staraidocdb` (hardcoded in connection.py)

This is why I didn't find datasets in the local `mongodb` container when checking there initially.

### No TTL Indexes

I verified there are **no TTL (Time-To-Live) indexes** on any collections. Datasets were never being auto-deleted - they were always there, just unmatchable due to the type mismatch.

## Status

✅ **Fixed and Deployed**
- Backend restarted with fixes
- Migration completed successfully
- All new documents will use proper ObjectId types
- All existing documents converted to ObjectId types

## Files Changed

1. `/backend/app/repositories/anomaly_repo.py` - Added ObjectId conversion in create functions
2. `/backend/migrate_objectids.py` - Migration script (new file)
3. `/backend/diagnose_db.py` - Diagnostic script (new file, for troubleshooting)

## Next Steps

The fix is complete and deployed. You can now:
1. Test the upload → analyze flow
2. Delete the migration script if you don't need it anymore: `rm backend/migrate_objectids.py backend/diagnose_db.py`
3. Continue with LLM integration and frontend development
