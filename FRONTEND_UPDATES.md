# Frontend Updates - 3-Stage Anomaly Detection Workflow

## Summary

The frontend has been updated to support the new 3-stage workflow:
1. **Upload** → File saved to S3/MongoDB
2. **Autoencoder Analysis** → Detect anomalies
3. **LLM Triage** → AI-powered security analysis

---

## Files Modified

### 1. HomePage.jsx (`/frontend/src/pages/HomePage/HomePage.jsx`)

**Changes:**
- Updated status tag colors to handle new states: `uploaded`, `analyzed`, `analyzing`, `triaging`, `error`
- Changed button text logic: `'uploaded'` status now shows "Analyze" button instead of `'pending'`

**New Status Colors:**
```jsx
<Tag color={
  dataset.status === 'completed' ? 'green' :
  dataset.status === 'analyzed' ? 'cyan' :      // New
  dataset.status === 'triaging' ? 'blue' :      // New
  dataset.status === 'analyzing' ? 'blue' :     // New
  dataset.status === 'error' ? 'red' :          // New
  'orange'
}>
```

---

### 2. DatasetDetailPage.jsx (`/frontend/src/pages/DatasetDetail/DatasetDetailPage.jsx`)

**Major Changes:**

#### A. Updated API Endpoints

**Old:**
```jsx
// Single "analyze" endpoint
POST /anomaly/datasets/${datasetId}/analyze-test
POST /anomaly/datasets/${datasetId}/analyze-with-llm
```

**New:**
```jsx
// Separate endpoints for each stage
POST /anomaly/datasets/${datasetId}/start-autoencoder
POST /anomaly/datasets/${datasetId}/start-llm-analysis
```

#### B. Renamed Functions

| Old Function | New Function | Purpose |
|-------------|--------------|---------|
| `handleAnalyze()` | `handleAutoencoder()` | Trigger autoencoder analysis |
| `handleLLMAnalysis()` | `handleLLMAnalysis()` | Trigger LLM triage (no change) |

#### C. New Status Badge Configuration

Added support for all new statuses with appropriate icons and colors:

```jsx
const statusConfig = {
  uploaded: { color: "default", icon: <ClockCircleOutlined />, text: "Uploaded" },
  parsing: { color: "blue", icon: <Spin size="small" />, text: "Parsing" },
  parsed: { color: "cyan", icon: <CheckCircleOutlined />, text: "Parsed" },
  analyzing: { color: "blue", icon: <Spin size="small" />, text: "Analyzing (Autoencoder)" },
  analyzed: { color: "cyan", icon: <CheckCircleOutlined />, text: "Analyzed - Ready for LLM" },
  triaging: { color: "purple", icon: <Spin size="small" />, text: "AI Triage in Progress" },
  completed: { color: "green", icon: <CheckCircleOutlined />, text: "Completed" },
  error: { color: "red", icon: <WarningOutlined />, text: "Error" },
};
```

#### D. Workflow State Logic

**Old:**
```jsx
const needsAnalysis = dataset.status === "pending" || dataset.status === "failed";
const isAnalyzed = dataset.status === "completed";
```

**New:**
```jsx
const needsAutoencoder = dataset.status === "uploaded" || dataset.status === "error";
const needsLLM = dataset.status === "analyzed";
const isCompleted = dataset.status === "completed";
const isProcessing = dataset.status === "analyzing" || dataset.status === "triaging" || dataset.status === "parsing";
```

#### E. UI Flow

**Stage 1: After Upload (Status = "uploaded")**
```
┌──────────────────────────────────────────┐
│ 🤖 Step 2: Run Autoencoder Analysis     │
│                                          │
│ Click to train autoencoder and detect   │
│ anomalies...                             │
│                                          │
│         [Start Autoencoder]              │
└──────────────────────────────────────────┘
```

**Stage 2: Autoencoder Running (Status = "analyzing")**
```
┌──────────────────────────────────────────┐
│ 🤖 Running Autoencoder Analysis...       │
│ ████████████░░░░░░ 60%                   │
│ This may take a few minutes...           │
└──────────────────────────────────────────┘
```

**Stage 3: Autoencoder Complete (Status = "analyzed")**
```
┌──────────────────────────────────────────┐
│ 🧠 Step 3: Run AI Triage Analysis       │
│                                          │
│ ✅ Autoencoder detected 247 anomalies!  │
│                                          │
│ Now run AI-powered security triage...   │
│                                          │
│     [🧠 Analyze Top 2 with AI]          │
│     [Analyze Top 10]                     │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ⚠️ Detected Anomalies (247)             │
│                                          │
│ [Table showing all detected anomalies]  │
└──────────────────────────────────────────┘
```

**Stage 4: LLM Running (Status = "triaging")**
```
┌──────────────────────────────────────────┐
│ 🤖 Running AI Triage Analysis...        │
│ ⏳ Spinner                               │
│ Sending anomalies to Azure OpenAI...    │
└──────────────────────────────────────────┘
```

**Stage 5: Complete (Status = "completed")**
```
┌──────────────────────────────────────────┐
│ ✅ Analysis Complete!                    │
│                                          │
│ All stages completed. 10 AI triage      │
│ reports generated.                       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ ⚠️ Detected Anomalies (247)             │
│ [Table with anomaly details]             │
└──────────────────────────────────────────┘
```

---

## User Flow Comparison

### Old Flow (Single Step)

```
Upload → Click "Start Analysis" → Wait → View Results
         (Autoencoder + LLM together)
```

**Issues:**
- No control over stages
- Can't see intermediate results
- Long wait time with no visibility

---

### New Flow (3 Stages)

```
Step 1: Upload File
   ↓
   Status: "uploaded"
   Shows: "Start Autoencoder" button

Step 2: Click "Start Autoencoder"
   ↓
   Status: "analyzing" → "analyzed"
   Shows: Progress bar → Anomaly count + "Start LLM" button

Step 3: Click "Start LLM Analysis"
   ↓
   Status: "triaging" → "completed"
   Shows: Spinner → Success message + Full results
```

**Benefits:**
- ✅ User controls each stage
- ✅ Can inspect autoencoder results before LLM
- ✅ Better progress visibility
- ✅ Can choose how many anomalies to analyze with LLM
- ✅ Saves on LLM costs (only analyze what you need)

---

## Testing Checklist

### 1. Upload Flow
- [ ] Upload .xlsx file
- [ ] Verify status shows "uploaded"
- [ ] Verify "Start Autoencoder" button appears
- [ ] Tag color is orange

### 2. Autoencoder Flow
- [ ] Click "Start Autoencoder"
- [ ] Progress bar animates
- [ ] Status changes to "analyzing"
- [ ] Success message shows anomaly count
- [ ] Status changes to "analyzed"
- [ ] Tag color is cyan
- [ ] Anomaly table appears
- [ ] "Start LLM Analysis" button appears

### 3. LLM Flow
- [ ] Click "Analyze Top 2 with AI"
- [ ] Status changes to "triaging"
- [ ] Spinner shows
- [ ] Success message appears
- [ ] Status changes to "completed"
- [ ] Tag color is green
- [ ] Full analysis visible

### 4. Error Handling
- [ ] If autoencoder fails → status = "error", can retry
- [ ] If LLM fails → error message shown, can retry
- [ ] Network errors show proper toast messages

### 5. Status Polling (Optional Future Enhancement)
```jsx
// Poll for status updates during long-running operations
useEffect(() => {
  if (dataset.status === 'analyzing' || dataset.status === 'triaging') {
    const interval = setInterval(async () => {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_BASE_URL}/anomaly/datasets/${datasetId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setDataset(data);

      if (data.status === 'analyzed' || data.status === 'completed') {
        clearInterval(interval);
        await fetchAnomalies();
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }
}, [dataset?.status]);
```

---

## Environment Variables

No changes needed to `.env` files. The frontend still uses:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## Breaking Changes

### API Endpoints Renamed

| Old Endpoint | New Endpoint | Migration |
|-------------|--------------|-----------|
| `/datasets/{id}/analyze-test` | `/datasets/{id}/start-autoencoder` | Update all calls |
| `/datasets/{id}/analyze-with-llm` | `/datasets/{id}/start-llm-analysis` | Update all calls |

### Status Values Changed

| Old Status | New Status | When |
|-----------|-----------|------|
| `"pending"` | `"uploaded"` | After file upload |
| `"processing"` | `"analyzing"` | During autoencoder |
| N/A | `"analyzed"` | Autoencoder complete |
| N/A | `"triaging"` | During LLM analysis |
| `"completed"` | `"completed"` | All done (same) |
| `"failed"` | `"error"` | Error occurred |

---

## Next Steps

1. ✅ Backend updated with new endpoints
2. ✅ Frontend updated with new workflow
3. 🔄 Test full workflow end-to-end
4. 📝 Update user documentation
5. 🎨 (Optional) Add status polling for real-time updates
6. 🎨 (Optional) Add LLM explanation viewer page

---

## Common Issues & Solutions

### Issue: "Dataset must be analyzed first" error

**Cause:** Trying to run LLM before autoencoder
**Solution:** The UI now prevents this by only showing LLM button when `status === "analyzed"`

### Issue: Duplicate key error in sessions

**Cause:** Multiple analysis attempts on same dataset
**Solution:** Backend now reuses existing sessions (fixed in backend update)

### Issue: Status not updating after analysis

**Cause:** Frontend not refreshing dataset
**Solution:** Both `handleAutoencoder()` and `handleLLMAnalysis()` now call `fetchDataset()` after success

---

## Files Changed Summary

```
✅ frontend/src/pages/HomePage/HomePage.jsx
   - Updated status colors and button logic

✅ frontend/src/pages/DatasetDetail/DatasetDetailPage.jsx
   - Renamed handleAnalyze → handleAutoencoder
   - Updated API endpoints
   - Added new status badges
   - Implemented 3-stage UI flow
   - Added completion success message
```

---

## Screenshots of New Flow

### Status Badge Examples

- **Uploaded**: Gray badge with clock icon
- **Analyzing**: Blue badge with spinner
- **Analyzed**: Cyan badge with checkmark
- **Triaging**: Purple badge with spinner
- **Completed**: Green badge with checkmark
- **Error**: Red badge with warning icon

---

Ready to test! 🚀
