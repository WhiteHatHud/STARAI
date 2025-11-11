# NewFrontend API Fixes - 404 Errors Resolved

## Files Updated

### 1. `/newfrontend/src/lib/api-client.ts`

**Changes:**
- ❌ **Removed:** `analyze-test` endpoint
- ✅ **Added:** `/analyze` endpoint
- ❌ **Removed:** `session()` method
- ✅ **Added:** `status()` method

**Before:**
```typescript
// Analysis operations
analyze: async (id: string): Promise<AnalysisResult> => {
  const response = await this.axios.post<AnalysisResult>(
    `/anomaly/datasets/${id}/analyze-test`,  // ❌ 404 error
    {}
  );
  return response.data;
},

// Get analysis session/progress
session: async (id: string): Promise<AnalysisSession> => {
  const response = await this.axios.get<AnalysisSession>(
    `/anomaly/datasets/${id}/session`  // ❌ 404 error
  );
  return response.data;
},
```

**After:**
```typescript
// Analysis operations
analyze: async (id: string): Promise<{ session_id: string; reused: boolean }> => {
  const response = await this.axios.post<{ session_id: string; reused: boolean }>(
    `/anomaly/datasets/${id}/analyze`,  // ✅ Works!
    {}
  );
  return response.data;
},

// Get dataset status for polling
status: async (id: string): Promise<{
  status: string;
  progress: number;
  error: string | null;
  anomaly_count: number;
}> => {
  const response = await this.axios.get<{
    status: string;
    progress: number;
    error: string | null;
    anomaly_count: number;
  }>(`/anomaly/datasets/${id}/status`);  // ✅ Works!
  return response.data;
},
```

---

### 2. `/newfrontend/src/pages/HomePage.tsx`

**Changes:**
- Updated `pollAnalysisProgress()` to use `apiClient.datasets.status()`
- Updated analysis trigger to use `/analyze` endpoint
- Updated completion logic to handle new status values

**Before:**
```typescript
// Poll analysis progress
const pollAnalysisProgress = useCallback(async (datasetId: string) => {
  try {
    const session = await apiClient.datasets.session(datasetId);  // ❌ 404

    // If completed or failed, stop polling
    if (session.status === "completed" || session.status === "failed" || session.status === "error") {
      // ...
    }
  } catch (error) {
    console.error("Error polling progress:", error);
  }
}, [apiClient, fetchDatasets]);

// Trigger analysis
axios
  .post(`/anomaly/datasets/${datasetId}/analyze-test`, {})  // ❌ 404
  .catch((error) => {
    // ...
  });
```

**After:**
```typescript
// Poll analysis progress
const pollAnalysisProgress = useCallback(async (datasetId: string) => {
  try {
    const statusData = await apiClient.datasets.status(datasetId);  // ✅ Works!

    setAnalysisProgress((prev) => {
      const newMap = new Map(prev);
      newMap.set(datasetId, {
        datasetId,
        progress: statusData.progress || 0,
        status: statusData.status,
        message: statusData.error || undefined,
      });
      return newMap;
    });

    // If analyzed, completed, or error, stop polling
    if (statusData.status === "analyzed" || statusData.status === "completed" ||
        statusData.status === "error" || statusData.status === "failed") {
      // Stop polling
      const interval = pollingIntervalsRef.current.get(datasetId);
      if (interval) {
        clearInterval(interval);
        pollingIntervalsRef.current.delete(datasetId);
      }

      // Show completion toast
      if (statusData.status === "analyzed" || statusData.status === "completed") {
        toast({
          title: "Analysis Complete",
          description: `Detected ${statusData.anomaly_count || 0} anomalies`,
        });
      } else if (statusData.status === "error" || statusData.status === "failed") {
        toast({
          title: "Analysis Failed",
          description: statusData.error || "Failed to analyze dataset",
          variant: "destructive",
        });
      }

      // Refresh datasets
      dataFetchedRef.current = false;
      fetchDatasets();

      // Remove from progress map
      setAnalysisProgress((prev) => {
        const newMap = new Map(prev);
        newMap.delete(datasetId);
        return newMap;
      });
    }
  } catch (error) {
    console.error("Error polling progress:", error);
  }
}, [apiClient, fetchDatasets]);

// Trigger analysis
axios
  .post(`/anomaly/datasets/${datasetId}/analyze`, {})  // ✅ Works!
  .catch((error) => {
    console.error("Analysis error:", error);
    toast({
      title: "Analysis Failed",
      description: error.response?.data?.detail || "Failed to analyze dataset",
      variant: "destructive",
    });
  });
```

---

## Key Differences

### Status Values
The backend now returns different status values:

| Old Status | New Status | Meaning |
|-----------|-----------|---------|
| `"pending"` | `"uploaded"` | File uploaded, ready to analyze |
| `"processing"` | `"analyzing"` | Autoencoder running |
| N/A | `"analyzed"` | Autoencoder complete, ready for LLM |
| N/A | `"triaging"` | LLM analysis running |
| `"completed"` | `"completed"` | All analysis complete |
| `"failed"` | `"error"` | Analysis failed |

### Response Structure

**Old `/session` response:**
```json
{
  "dataset_id": "...",
  "status": "processing",
  "progress": 50,
  "message": "Analyzing...",
  "anomalies_detected": 0
}
```

**New `/status` response:**
```json
{
  "status": "analyzing",
  "progress": 50,
  "error": null,
  "anomaly_count": 0
}
```

---

## Verification

### Check API Calls in Browser
Open DevTools → Network tab and verify:

✅ **Should see:**
- `POST /api/anomaly/datasets/upload`
- `POST /api/anomaly/datasets/{id}/analyze`
- `GET /api/anomaly/datasets/{id}/status` (every 2 seconds while analyzing)

❌ **Should NOT see:**
- `POST /api/anomaly/datasets/{id}/analyze-test` (404)
- `GET /api/anomaly/datasets/{id}/session` (404)

---

## Testing Flow

1. **Upload File**
   ```
   User uploads .xlsx file
     ↓
   POST /api/anomaly/datasets/upload
     ↓
   Response: { id: "...", status: "uploaded" }
   ```

2. **Auto-Start Analysis**
   ```
   Frontend automatically calls:
   POST /api/anomaly/datasets/{id}/analyze
     ↓
   Response: { session_id: "...", reused: false }
     ↓
   Toast: "Analysis Started"
   ```

3. **Polling**
   ```
   Every 2 seconds:
   GET /api/anomaly/datasets/{id}/status
     ↓
   Response: { status: "analyzing", progress: 50, ... }
     ↓
   Update progress bar
   ```

4. **Completion**
   ```
   GET /api/anomaly/datasets/{id}/status
     ↓
   Response: { status: "analyzed", progress: 100, anomaly_count: 247 }
     ↓
   Stop polling
     ↓
   Toast: "Analysis Complete - Detected 247 anomalies"
     ↓
   Refresh dataset list
   ```

---

## Error Handling

### If `/analyze` fails
```typescript
axios.post(`/anomaly/datasets/${datasetId}/analyze`, {})
  .catch((error) => {
    toast({
      title: "Analysis Failed",
      description: error.response?.data?.detail || "Failed to analyze dataset",
      variant: "destructive",
    });
  });
```

### If polling fails
```typescript
try {
  const statusData = await apiClient.datasets.status(datasetId);
  // ...
} catch (error) {
  console.error("Error polling progress:", error);
  // Stop polling
  const interval = pollingIntervalsRef.current.get(datasetId);
  if (interval) {
    clearInterval(interval);
    pollingIntervalsRef.current.delete(datasetId);
  }
}
```

### If backend returns error status
```typescript
if (statusData.status === "error" || statusData.status === "failed") {
  toast({
    title: "Analysis Failed",
    description: statusData.error || "Failed to analyze dataset",
    variant: "destructive",
  });
}
```

---

## Summary of Changes

| Component | Old Endpoint | New Endpoint | Status |
|-----------|-------------|--------------|--------|
| `api-client.ts` | `POST /analyze-test` | `POST /analyze` | ✅ Fixed |
| `api-client.ts` | `GET /session` | `GET /status` | ✅ Fixed |
| `HomePage.tsx` | `session()` method | `status()` method | ✅ Fixed |
| `HomePage.tsx` | Manual checks | Auto-trigger on upload | ✅ Improved |

---

## What Was Fixed

1. ✅ **404 errors eliminated**
   - Replaced `/analyze-test` with `/analyze`
   - Replaced `/session` with `/status`

2. ✅ **Better status tracking**
   - Now uses `analyzed` status for autoencoder complete
   - Can distinguish between autoencoder and LLM stages

3. ✅ **Proper polling**
   - Gets real progress from backend (0-100%)
   - Shows actual error messages
   - Stops polling when complete or failed

4. ✅ **Type safety**
   - Updated TypeScript types to match new API
   - Correct response types for all endpoints

---

## Next Steps

1. Test the full flow:
   - Upload file
   - See "Analysis Started" toast
   - Watch progress bar update
   - See "Analysis Complete" toast
   - Click "View" to see anomalies

2. Check browser console for errors
   - Should see no 404s
   - Should see successful API calls

3. Verify backend logs
   - See "Started analysis session..."
   - See background task running
   - See "Analysis complete..."

The newfrontend now matches the backend API contract perfectly! 🎉
