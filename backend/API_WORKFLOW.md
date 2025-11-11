# Anomaly Detection API Workflow

## Overview

The anomaly detection system now uses a **3-step workflow** that separates upload, autoencoder analysis, and LLM triage into distinct stages. This gives users control over each step and allows for better progress tracking.

---

## Workflow Steps

### Step 1: Upload Dataset 📤

**Endpoint:** `POST /api/anomaly/datasets/upload`

**What it does:**
- Validates Excel/CSV file
- Uploads file to S3
- Creates dataset record in MongoDB
- Sets status to `uploaded`

**Status after:** `uploaded`

**Frontend Action:** Show "Start Autoencoder Analysis" button

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@dataset.xlsx"
```

**Example Response:**
```json
{
  "id": "673abc123...",
  "filename": "user_20241110_dataset.xlsx",
  "status": "uploaded",
  "anomaly_count": 0,
  "uploaded_at": "2024-11-10T14:30:00Z"
}
```

---

### Step 2: Run Autoencoder Analysis 🤖

**Endpoint:** `POST /api/anomaly/datasets/{dataset_id}/start-autoencoder`

**What it does:**
- Downloads file from S3
- Trains autoencoder model on the data
- Detects anomalies (outliers)
- Stores ALL anomalies in database
- Sets status to `analyzed`

**Status flow:** `uploaded` → `analyzing` → `analyzed`

**Frontend Action:** Show "Start LLM Analysis" button

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/anomaly/datasets/673abc123.../start-autoencoder" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "dataset_id": "673abc123...",
  "status": "analyzed",
  "total_rows": 10000,
  "anomalies_detected": 247,
  "anomalies_stored": 247,
  "anomaly_percentage": "2.47%",
  "threshold_used": 0.023
}
```

---

### Step 3: Run LLM Triage Analysis 🧠

**Endpoint:** `POST /api/anomaly/datasets/{dataset_id}/start-llm-analysis`

**What it does:**
- Verifies dataset status is `analyzed`
- Fetches detected anomalies (sorted by score)
- Sends top N anomalies to Azure OpenAI GPT-5-mini
- Gets detailed triage analysis (severity, MITRE ATT&CK, recommendations)
- Stores LLM explanations
- Sets status to `completed`

**Status flow:** `analyzed` → `triaging` → `completed`

**Frontend Action:** Show "View Results" or "View Report" button

**Query Parameters:**
- `max_anomalies` (optional, default: 2): Number of top anomalies to analyze with LLM

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/anomaly/datasets/673abc123.../start-llm-analysis?max_anomalies=10" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**
```json
{
  "dataset_id": "673abc123...",
  "total_anomalies_detected": 247,
  "anomalies_analyzed_by_llm": 10,
  "explanations_created": 10,
  "explanations_skipped": 0,
  "errors": [],
  "status": "completed",
  "note": "Analyzed top 10 highest-scoring anomalies out of 247 total"
}
```

---

## Dataset Status States

| Status | Description | Next Action |
|--------|-------------|-------------|
| `uploaded` | File uploaded to S3 and MongoDB | Click "Start Autoencoder" |
| `parsing` | Parsing file structure | Wait... |
| `parsed` | File parsed successfully | - |
| `analyzing` | Running autoencoder | Wait... |
| `analyzed` | Anomalies detected | Click "Start LLM Analysis" |
| `triaging` | Running LLM triage | Wait... |
| `completed` | All analysis complete | View results |
| `error` | Error occurred | Check logs |

---

## Frontend Implementation Guide

### Dataset Card Component

```tsx
function DatasetCard({ dataset }) {
  const [status, setStatus] = useState(dataset.status);
  const [loading, setLoading] = useState(false);

  async function startAutoencoder() {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `/api/anomaly/datasets/${dataset.id}/start-autoencoder`
      );
      setStatus("analyzed");
      toast.success(`Detected ${data.anomalies_detected} anomalies!`);
    } catch (e) {
      toast.error("Autoencoder failed");
    } finally {
      setLoading(false);
    }
  }

  async function startLLM() {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `/api/anomaly/datasets/${dataset.id}/start-llm-analysis?max_anomalies=10`
      );
      setStatus("completed");
      toast.success(`LLM analysis complete!`);
    } catch (e) {
      toast.error("LLM analysis failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4">
      <h3>{dataset.filename}</h3>
      <p>Status: <StatusBadge status={status} /></p>

      {status === "uploaded" && (
        <button onClick={startAutoencoder} disabled={loading}>
          {loading ? "Running..." : "🤖 Start Autoencoder"}
        </button>
      )}

      {status === "analyzed" && (
        <div>
          <p>✅ {dataset.anomaly_count} anomalies detected</p>
          <button onClick={startLLM} disabled={loading}>
            {loading ? "Analyzing..." : "🧠 Start LLM Analysis"}
          </button>
        </div>
      )}

      {status === "completed" && (
        <button onClick={() => navigate(`/results/${dataset.id}`)}>
          📊 View Results
        </button>
      )}

      {(status === "analyzing" || status === "triaging") && (
        <div>
          <Spinner />
          <p>Processing...</p>
        </div>
      )}
    </div>
  );
}
```

### Status Polling (Optional)

```tsx
useEffect(() => {
  if (["analyzing", "triaging"].includes(status)) {
    const interval = setInterval(async () => {
      const { data } = await axios.get(`/api/anomaly/datasets/${dataset.id}`);
      setStatus(data.status);
      if (data.status === "analyzed" || data.status === "completed") {
        clearInterval(interval);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }
}, [status]);
```

---

## Error Handling

### Common Errors

1. **"Dataset must be analyzed first"**
   - User tried to run LLM analysis before autoencoder
   - Solution: Show error and prompt to run autoencoder first

2. **"No anomalies found for this dataset"**
   - Autoencoder didn't detect any anomalies
   - Solution: Show message that dataset appears normal

3. **"Azure OpenAI is not configured"**
   - Missing environment variables
   - Solution: Check backend `.env.local` file

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Required Status |
|----------|--------|---------|----------------|
| `/datasets/upload` | POST | Upload file | - |
| `/datasets/{id}` | GET | Get dataset info | - |
| `/datasets` | GET | List all datasets | - |
| `/datasets/{id}/start-autoencoder` | POST | Run autoencoder | `uploaded` |
| `/datasets/{id}/start-llm-analysis` | POST | Run LLM triage | `analyzed` |
| `/datasets/{id}/anomalies` | GET | Get detected anomalies | `analyzed`+ |
| `/datasets/{id}/llm-explanations` | GET | Get LLM analyses | `completed` |

---

## Testing the Workflow

### Manual Test Script

```bash
# 1. Upload
DATASET_ID=$(curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_data.xlsx" | jq -r '.id')

echo "Dataset ID: $DATASET_ID"

# 2. Start Autoencoder
curl -X POST "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/start-autoencoder" \
  -H "Authorization: Bearer $TOKEN"

# Wait for it to complete...
sleep 30

# 3. Start LLM Analysis
curl -X POST "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/start-llm-analysis?max_anomalies=5" \
  -H "Authorization: Bearer $TOKEN"

# 4. Get results
curl "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/llm-explanations" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Migration Notes

### Old Endpoints (Deprecated)

- ❌ `/datasets/{id}/analyze-test` → Use `/datasets/{id}/start-autoencoder`
- ❌ `/datasets/{id}/analyze-with-llm` → Use `/datasets/{id}/start-llm-analysis`

### Breaking Changes

1. Dataset status now includes: `analyzed` and `triaging`
2. LLM endpoint requires `analyzed` status
3. Autoencoder endpoint renamed

---

## Next Steps for Frontend

1. ✅ Update dataset upload to show "Start Autoencoder" button
2. ✅ Add "Start LLM Analysis" button after autoencoder completes
3. ✅ Implement status polling for long-running tasks
4. ✅ Add progress indicators for each stage
5. ✅ Update status badges to show new states
6. ✅ Add error handling for workflow violations
