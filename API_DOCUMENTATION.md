# Anomaly Detection API Documentation

## Base URL
```
Development: http://localhost:8000/api/anomaly
Production: https://your-domain.com/api/anomaly
```

---

## Authentication

All endpoints require JWT authentication via Bearer token:

```bash
Authorization: Bearer <your_jwt_token>
```

Get token via login:
```bash
POST /api/auth/login
{
  "username": "admin",
  "password": "password123"
}
```

---

## API Endpoints Overview

```
📁 DATASETS
POST   /api/anomaly/datasets/upload          Upload Excel file
GET    /api/anomaly/datasets                 List user's datasets
GET    /api/anomaly/datasets/{id}            Get dataset details
DELETE /api/anomaly/datasets/{id}            Delete dataset

🚨 ANOMALIES
GET    /api/anomaly/datasets/{id}/anomalies  List dataset anomalies
GET    /api/anomaly/anomalies/{id}           Get anomaly details

📊 REPORTS
GET    /api/anomaly/anomaly-reports          List user's reports
GET    /api/anomaly/anomaly-reports/{id}     Get full report + triage
POST   /api/anomaly/anomaly-reports          Create report (manual)
PATCH  /api/anomaly/anomaly-reports/{id}     Update report status
DELETE /api/anomaly/anomaly-reports/{id}     Delete report
GET    /api/anomaly/anomaly-reports/{id}/export  Export to PDF/Excel/JSON

⏱️ SESSIONS
GET    /api/anomaly/analysis-sessions/{id}   Get session progress
GET    /api/anomaly/datasets/{id}/session    Get dataset session

📈 ANALYTICS
GET    /api/anomaly/statistics               User statistics

🔍 HEALTH
GET    /api/anomaly/health                   Health check
```

---

## Complete Endpoint Reference

### 1. Upload Dataset

**Upload an Excel file for anomaly detection**

```http
POST /api/anomaly/datasets/upload
Content-Type: multipart/form-data
Authorization: Bearer <token>
```

**Request Body:**
```bash
# Form data
file: <security_logs.xlsx>
```

**Response:** `201 Created`
```json
{
  "_id": "673abcd1234567890abcdef0",
  "user_id": "673abc1234567890abcdef1",
  "filename": "admin_20251106_143000_security_logs.xlsx",
  "original_filename": "security_logs.xlsx",
  "s3_key": "datasets/673abc1234567890abcdef1/admin_20251106_143000_security_logs.xlsx",
  "file_size": 2048576,
  "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "parsed_data": null,
  "sheet_count": 0,
  "total_rows": 0,
  "status": "uploaded",
  "uploaded_at": "2025-11-06T14:30:00Z",
  "parsed_at": null
}
```

**Example:**
```bash
curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer eyJhbGc..." \
  -F "file=@security_logs.xlsx"
```

---

### 2. List Datasets

**Get all datasets for the current user**

```http
GET /api/anomaly/datasets?status={status}&limit={limit}
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`uploaded`, `parsed`, `analyzing`, `completed`, `error`)
- `limit` (optional): Max results (default: 50, max: 100)

**Response:** `200 OK`
```json
[
  {
    "id": "673abcd1234567890abcdef0",
    "filename": "security_logs_nov2025.xlsx",
    "total_rows": 15000,
    "sheet_count": 3,
    "status": "completed",
    "uploaded_at": "2025-11-06T14:30:00Z",
    "anomalies_detected": 23
  }
]
```

**Example:**
```bash
curl "http://localhost:8000/api/anomaly/datasets?status=completed&limit=10" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 3. Get Dataset Details

**Get full dataset information including parsed data**

```http
GET /api/anomaly/datasets/{dataset_id}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "673abcd1234567890abcdef0",
  "user_id": "673abc1234567890abcdef1",
  "filename": "security_logs_nov2025.xlsx",
  "original_filename": "Security Logs Nov 2025.xlsx",
  "s3_key": "datasets/user123/security_logs.xlsx",
  "file_size": 2048576,
  "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "parsed_data": {
    "workbookMeta": {
      "sheetNames": ["Access Logs", "Network Traffic", "Errors"],
      "sheetCount": 3,
      "totalRows": 15000
    },
    "sheets": [...]
  },
  "sheet_count": 3,
  "total_rows": 15000,
  "status": "completed",
  "uploaded_at": "2025-11-06T14:30:00Z",
  "parsed_at": "2025-11-06T14:31:30Z"
}
```

---

### 4. Delete Dataset

**Delete dataset and all associated anomalies/reports**

```http
DELETE /api/anomaly/datasets/{dataset_id}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

**Example:**
```bash
curl -X DELETE "http://localhost:8000/api/anomaly/datasets/673abcd..." \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 5. List Dataset Anomalies

**Get all detected anomalies for a dataset**

```http
GET /api/anomaly/datasets/{dataset_id}/anomalies?status={status}&min_score={score}
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`detected`, `triaging`, `triaged`, `resolved`, `false_positive`)
- `min_score` (optional): Minimum anomaly score (0.0-1.0)

**Response:** `200 OK`
```json
[
  {
    "_id": "673def1234567890abcdef2",
    "dataset_id": "673abcd1234567890abcdef0",
    "user_id": "673abc1234567890abcdef1",
    "anomaly_score": 0.87,
    "row_index": 1523,
    "sheet_name": "Access Logs",
    "raw_data": {
      "user_id": "john.doe@hospital.sg",
      "timestamp": "2025-11-06T03:15:22Z",
      "records_accessed": 15000,
      "source_ip": "185.220.101.42",
      "location": "Moscow, Russia"
    },
    "anomalous_features": [
      {
        "feature_name": "records_accessed",
        "actual_value": 15000,
        "expected_value": 50,
        "deviation": "+300x usual volume",
        "contribution_score": 0.35
      },
      {
        "feature_name": "access_time",
        "actual_value": "03:15",
        "expected_value": "09:00-17:00",
        "deviation": "+18 hours from norm",
        "contribution_score": 0.40
      }
    ],
    "status": "triaged",
    "detected_at": "2025-11-06T14:30:00Z",
    "triaged_at": "2025-11-06T14:32:00Z"
  }
]
```

**Example:**
```bash
curl "http://localhost:8000/api/anomaly/datasets/673abcd.../anomalies?min_score=0.8" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 6. Get Anomaly Details

**Get detailed information about a specific anomaly**

```http
GET /api/anomaly/anomalies/{anomaly_id}
Authorization: Bearer <token>
```

**Response:** `200 OK` (same structure as list anomalies)

---

### 7. List Anomaly Reports

**Get all anomaly reports for the current user**

```http
GET /api/anomaly/anomaly-reports?status={status}&dataset_id={id}&severity={level}&limit={limit}
Authorization: Bearer <token>
```

**Query Parameters:**
- `status` (optional): Filter by status (`pending_triage`, `triaged`, `under_review`, `resolved`, `false_positive`)
- `dataset_id` (optional): Filter by dataset
- `severity` (optional): Filter by severity (`low`, `medium`, `high`, `critical`)
- `limit` (optional): Max results (default: 100, max: 500)

**Response:** `200 OK`
```json
[
  {
    "id": "673xyz1234567890abcdef3",
    "dataset_filename": "security_logs_nov2025.xlsx",
    "severity": "critical",
    "anomaly_score": 0.87,
    "status": "triaged",
    "created_at": "2025-11-06T14:30:00Z",
    "threat_type": "Data Exfiltration - Insider Threat"
  }
]
```

**Example:**
```bash
curl "http://localhost:8000/api/anomaly/anomaly-reports?status=triaged&severity=critical" \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 8. Get Full Anomaly Report

**Get complete report with triage analysis**

```http
GET /api/anomaly/anomaly-reports/{report_id}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "673xyz1234567890abcdef3",
  "user_id": "673abc1234567890abcdef1",
  "dataset_id": "673abcd1234567890abcdef0",
  "anomaly_id": "673def1234567890abcdef2",
  "triage": {
    "severity": "critical",
    "severity_score": 9.2,
    "reasoning": [
      "Large-scale biometric data access detected",
      "Access from known threat actor region",
      "Outside business hours indicates unauthorized activity",
      "Volume suggests automated data exfiltration"
    ],
    "threat_context": {
      "threat_type": "Data Exfiltration - Insider Threat",
      "attack_stage": "Exfiltration (Stage 6 of 7)",
      "mitre_tactics": ["TA0010", "TA0009"],
      "indicators_of_compromise": [
        "Unusual geographic access (Russia, known APT28 infrastructure)",
        "Time-based anomaly (3am vs normal 9am-5pm)",
        "Volume spike (15,000 vs avg 50 records)",
        "Biometric data targeted (high-value PII)"
      ],
      "likely_attribution": "APT28 (Fancy Bear) infrastructure"
    },
    "impact": {
      "affected_records": 15000,
      "data_type": "Biometric PII",
      "estimated_cost": "$2,475,000",
      "compliance_violations": ["GDPR", "HIPAA", "PDPA"],
      "regulatory_fine_risk": "Up to $5,000,000 (PDPA) + GDPR 4% revenue"
    },
    "immediate_actions": [
      {
        "priority": 1,
        "action": "Suspend user account 'john.doe@hospital.sg' immediately",
        "command": "aws iam update-login-profile --user-name john.doe --no-password-reset-required",
        "rationale": "Prevent further data access while investigating",
        "estimated_time": "< 1 minute",
        "automation_available": true,
        "requires_manual_review": false
      },
      {
        "priority": 2,
        "action": "Block source IP 185.220.101.42 at firewall",
        "command": "firewall-cmd --add-rich-rule='rule family=ipv4 source address=185.220.101.42 reject'",
        "rationale": "Stop ongoing exfiltration",
        "estimated_time": "< 1 minute",
        "automation_available": true,
        "requires_manual_review": false
      }
    ],
    "short_term_actions": [
      {
        "action": "Force password reset for all accounts with similar access patterns",
        "timeline": "Within 1 hour",
        "automation_available": true
      }
    ],
    "long_term_actions": [
      {
        "action": "Implement geographic access controls (whitelist Singapore IPs)",
        "timeline": "Within 24 hours"
      }
    ],
    "forensic_data": {
      "preserve_immediately": [
        "Database query logs (2025-11-06 02:00 - 04:00 UTC)",
        "Network packet captures from source IP",
        "Authentication logs for user account"
      ],
      "legal_holds": [
        "User account email/chat logs",
        "VPN/firewall logs showing access path"
      ],
      "chain_of_custody": {
        "evidence_hash": "sha256:a3f5...",
        "collected_by": "STARAI Automated System",
        "timestamp": "2025-11-06T14:32:25Z"
      }
    },
    "confidence": {
      "overall_confidence": 0.94,
      "anomaly_detection_confidence": 0.87,
      "threat_classification_confidence": 0.95,
      "contextual_analysis_confidence": 0.93,
      "false_positive_probability": 0.06,
      "requires_human_review": false
    },
    "similar_incidents_count": 2,
    "historical_context": "This is the 3rd incident involving after-hours biometric access",
    "generated_by": "Foundation-Sec-8B",
    "generated_at": "2025-11-06T14:32:42Z",
    "processing_time_seconds": 24.3
  },
  "status": "triaged",
  "assigned_to": null,
  "resolution_notes": null,
  "user_feedback": null,
  "created_at": "2025-11-06T14:30:00Z",
  "triaged_at": "2025-11-06T14:32:42Z",
  "reviewed_at": null,
  "resolved_at": null
}
```

---

### 9. Update Anomaly Report

**Update report status and user actions**

```http
PATCH /api/anomaly/anomaly-reports/{report_id}
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "status": "under_review",
  "assigned_to": "security-team@hospital.sg",
  "resolution_notes": "Account suspended. Investigating with IT forensics team.",
  "user_feedback": null
}
```

**Response:** `200 OK` (returns updated report)

**Example:**
```bash
curl -X PATCH "http://localhost:8000/api/anomaly/anomaly-reports/673xyz..." \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "resolved",
    "resolution_notes": "False alarm - legitimate after-hours maintenance"
  }'
```

---

### 10. Export Anomaly Report

**Export report to PDF, Excel, or JSON**

```http
GET /api/anomaly/anomaly-reports/{report_id}/export?format={format}
Authorization: Bearer <token>
```

**Query Parameters:**
- `format` (required): Export format (`pdf`, `excel`, `json`)

**Response:** File download

**Example:**
```bash
# Export as JSON
curl "http://localhost:8000/api/anomaly/anomaly-reports/673xyz.../export?format=json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -o report.json

# Export as PDF (TODO: not yet implemented)
curl "http://localhost:8000/api/anomaly/anomaly-reports/673xyz.../export?format=pdf" \
  -H "Authorization: Bearer eyJhbGc..." \
  -o report.pdf
```

---

### 11. Get Analysis Session

**Get session progress for tracking**

```http
GET /api/anomaly/analysis-sessions/{session_id}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "673session1234567890",
  "user_id": "673abc1234567890abcdef1",
  "dataset_id": "673abcd1234567890abcdef0",
  "status": "triaging",
  "progress": 75,
  "current_step": "Performing triage analysis (15/20 anomalies)...",
  "total_rows_analyzed": 15000,
  "anomalies_detected": 20,
  "reports_generated": 15,
  "error_message": null,
  "started_at": "2025-11-06T14:30:00Z",
  "completed_at": null,
  "processing_time_seconds": null
}
```

**Example:**
```bash
curl "http://localhost:8000/api/anomaly/analysis-sessions/673session..." \
  -H "Authorization: Bearer eyJhbGc..."
```

---

### 12. Get Dataset Session

**Get analysis session for a specific dataset (polling)**

```http
GET /api/anomaly/datasets/{dataset_id}/session
Authorization: Bearer <token>
```

**Response:** `200 OK` (same structure as Get Analysis Session)

**Example (polling loop):**
```javascript
async function pollProgress(datasetId) {
  while (true) {
    const response = await fetch(
      `http://localhost:8000/api/anomaly/datasets/${datasetId}/session`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const session = await response.json();

    console.log(`Progress: ${session.progress}%`);
    console.log(`Status: ${session.current_step}`);

    if (session.status === 'completed' || session.status === 'error') {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s
  }
}
```

---

### 13. Get User Statistics

**Get summary statistics for user's activity**

```http
GET /api/anomaly/statistics
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "total_datasets": 15,
  "total_anomalies": 234,
  "total_reports": 234,
  "by_severity": {
    "critical": 12,
    "high": 45,
    "medium": 89,
    "low": 88
  },
  "by_status": {
    "pending_triage": 5,
    "triaged": 150,
    "under_review": 32,
    "resolved": 45,
    "false_positive": 2
  }
}
```

---

### 14. Health Check

**Check if anomaly detection service is running**

```http
GET /api/anomaly/health
```

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "service": "anomaly-detection",
  "timestamp": "2025-11-06T14:30:00.123456Z"
}
```

---

## Error Responses

All endpoints may return these error codes:

### 400 Bad Request
```json
{
  "detail": "Invalid file extension. Only .xlsx files are supported."
}
```

### 401 Unauthorized
```json
{
  "detail": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "detail": "Not authorized to access this resource"
}
```

### 404 Not Found
```json
{
  "detail": "Dataset not found"
}
```

### 409 Conflict
```json
{
  "detail": "Report already exists for this anomaly"
}
```

### 500 Internal Server Error
```json
{
  "detail": "Failed to upload dataset: <error message>"
}
```

### 501 Not Implemented
```json
{
  "detail": "PDF export not yet implemented. Use 'json' format for now."
}
```

---

## Complete Workflow Example

### Step-by-Step: Upload → Detect → Triage → Review

```bash
# 1. Login
TOKEN=$(curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}' \
  | jq -r '.access_token')

# 2. Upload dataset
DATASET_RESPONSE=$(curl -X POST "http://localhost:8000/api/anomaly/datasets/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@security_logs.xlsx")

DATASET_ID=$(echo $DATASET_RESPONSE | jq -r '._id')
echo "Uploaded dataset: $DATASET_ID"

# 3. Poll for completion
while true; do
  SESSION=$(curl "http://localhost:8000/api/anomaly/datasets/$DATASET_ID/session" \
    -H "Authorization: Bearer $TOKEN")

  STATUS=$(echo $SESSION | jq -r '.status')
  PROGRESS=$(echo $SESSION | jq -r '.progress')

  echo "Status: $STATUS - Progress: $PROGRESS%"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "error" ]; then
    break
  fi

  sleep 2
done

# 4. Get anomaly reports
REPORTS=$(curl "http://localhost:8000/api/anomaly/anomaly-reports?dataset_id=$DATASET_ID&status=triaged" \
  -H "Authorization: Bearer $TOKEN")

echo "Found $(echo $REPORTS | jq 'length') reports"

# 5. Get first critical report
REPORT_ID=$(echo $REPORTS | jq -r '.[0].id')

curl "http://localhost:8000/api/anomaly/anomaly-reports/$REPORT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.triage.severity, .triage.threat_context.threat_type, .triage.immediate_actions'

# 6. Mark as under review
curl -X PATCH "http://localhost:8000/api/anomaly/anomaly-reports/$REPORT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "under_review",
    "assigned_to": "security-team@company.com",
    "resolution_notes": "Investigating incident"
  }'

# 7. Export report
curl "http://localhost:8000/api/anomaly/anomaly-reports/$REPORT_ID/export?format=json" \
  -H "Authorization: Bearer $TOKEN" \
  -o "anomaly_report_$REPORT_ID.json"

echo "Report exported successfully"
```

---

## Interactive API Documentation

Once your backend is running, visit:

```
http://localhost:8000/docs
```

This provides an interactive Swagger UI to test all endpoints directly in your browser.

---

## Rate Limits

- Dataset uploads: 10 per hour per user
- API requests: 1000 per hour per user

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-repo/issues
- Email: support@your-domain.com
