# Anomaly Detection & LLM Analysis Workflow

## Overview

The anomaly detection system is designed to work with large datasets for accurate autoencoder training, while limiting LLM analysis to reduce costs and testing time.

## Two-Stage Process

### Stage 1: Anomaly Detection (Autoencoder)
**Endpoint:** `POST /api/anomaly/datasets/{dataset_id}/analyze-test`

**Purpose:**
- Trains the autoencoder on the **entire dataset** (needs large data for accurate pattern learning)
- Detects ALL anomalies
- Stores all detected anomalies in the database

**Why full dataset?**
The autoencoder needs sufficient data to learn what "normal" patterns look like. Small datasets lead to poor detection accuracy.

**Example Response:**
```json
{
  "dataset_id": "abc123",
  "status": "completed",
  "total_rows": 10000,
  "anomalies_detected": 150,
  "anomalies_stored": 150,
  "anomaly_percentage": "1.50%"
}
```

---

### Stage 2: LLM Triage Analysis
**Endpoint:** `POST /api/anomaly/datasets/{dataset_id}/analyze-with-llm?max_anomalies=2`

**Purpose:**
- Fetches detected anomalies from Stage 1
- Sorts by anomaly score (highest/most suspicious first)
- Sends only **top N anomalies** to Azure OpenAI for detailed analysis
- Stores LLM explanations in database

**Parameters:**
- `max_anomalies` (default: **2**) - Number of top anomalies to analyze with LLM
  - Min: 1
  - Max: 500
  - Default is intentionally small (2) for:
    - Faster testing iterations
    - Lower token usage/costs
    - Focused analysis on most critical alerts

**Why limit LLM analysis?**
1. **Cost:** LLM API calls are expensive. Analyzing 150 anomalies = 150 API calls
2. **Speed:** Testing is faster with fewer LLM calls
3. **Priority:** The highest-scoring anomalies are most likely to be real security threats

**Example Response:**
```json
{
  "dataset_id": "abc123",
  "total_anomalies_detected": 150,
  "anomalies_analyzed_by_llm": 2,
  "explanations_created": 2,
  "explanations_skipped": 0,
  "status": "completed",
  "note": "Analyzed top 2 highest-scoring anomalies out of 150 total"
}
```

---

## Usage Flow

### Testing (Default)
```bash
# 1. Upload dataset (large file recommended)
POST /api/anomaly/datasets/upload

# 2. Run anomaly detection on full dataset
POST /api/anomaly/datasets/{id}/analyze-test

# 3. Analyze top 2 anomalies with LLM (default)
POST /api/anomaly/datasets/{id}/analyze-with-llm
```

### Production (Analyze more anomalies)
```bash
# 1-2. Same as above

# 3. Analyze top 20 anomalies with LLM
POST /api/anomaly/datasets/{id}/analyze-with-llm?max_anomalies=20
```

---

## Benefits of This Approach

### ✅ For Autoencoder Training
- Uses entire dataset → learns accurate "normal" patterns
- Detects all anomalies → no suspicious events missed
- Stores everything → can analyze more later without re-running detection

### ✅ For LLM Analysis
- Analyzes only top N → faster testing
- Sorted by score → focuses on most suspicious
- Adjustable limit → scale up for production
- Lower token usage → reduced costs

### ✅ For Development
- Quick iteration cycles (2 anomalies = ~10 seconds)
- Easy to test prompt changes
- Predictable costs

---

## Adjusting the Limit

### Frontend (if integrated)
```typescript
// Analyze top 2 (default)
await api.post(`/api/anomaly/datasets/${datasetId}/analyze-with-llm`)

// Analyze top 10
await api.post(`/api/anomaly/datasets/${datasetId}/analyze-with-llm?max_anomalies=10`)

// Analyze all (not recommended for large datasets)
await api.post(`/api/anomaly/datasets/${datasetId}/analyze-with-llm?max_anomalies=500`)
```

### cURL
```bash
# Default (2 anomalies)
curl -X POST "http://localhost:8000/api/anomaly/datasets/{id}/analyze-with-llm" \
  -H "Authorization: Bearer $TOKEN"

# Custom limit (10 anomalies)
curl -X POST "http://localhost:8000/api/anomaly/datasets/{id}/analyze-with-llm?max_anomalies=10" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Cost Estimation

Assuming ~1000 tokens per anomaly analysis:

| max_anomalies | Total Tokens | Est. Cost (GPT-4) |
|---------------|--------------|-------------------|
| 2             | ~2,000       | $0.02             |
| 10            | ~10,000      | $0.10             |
| 50            | ~50,000      | $0.50             |
| 100           | ~100,000     | $1.00             |

*Costs are estimates and vary by model and pricing*

---

## Recommendations

### For Development/Testing
- Keep `max_anomalies=2` (default)
- Use small-medium datasets (100-1000 rows)
- Iterate quickly on prompt engineering

### For Production
- Start with `max_anomalies=20`
- Monitor false positive rate
- Adjust based on SOC analyst feedback
- Consider implementing:
  - Scheduled batch processing
  - Alert prioritization rules
  - Human-in-the-loop feedback

### For Large Deployments
- Process in batches (20-50 at a time)
- Implement async processing with Celery
- Add rate limiting for API calls
- Cache LLM results to avoid re-analysis
