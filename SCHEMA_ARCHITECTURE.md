# Anomaly Detection System - Database Schema Architecture

## Overview
This document describes the complete database schema architecture for the anomaly detection and security triage system.

---

## Collections Overview

```
MongoDB Database: staraidocdb
├── users                      [KEPT] User authentication
├── datasets                   [NEW] Uploaded Excel files
├── anomalies                  [NEW] Detected anomalies
├── anomaly_reports            [NEW] Triage reports
└── analysis_sessions          [NEW] Processing state tracking
```

**Removed Collections:**
- ❌ `cases` - Replaced by `datasets`
- ❌ `documents` - Not needed (Excel only, no PDF/DOCX)
- ❌ `chunks` - Not needed (no embeddings for Excel data)
- ❌ `reports` - Replaced by `anomaly_reports`
- ❌ `report_progress` - Replaced by `analysis_sessions`
- ❌ `slides` - Not needed

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER UPLOADS EXCEL FILE                                          │
│    POST /api/datasets/upload                                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. DATASET CREATED                                                  │
│    Collection: datasets                                             │
│    {                                                                │
│      user_id: "673abc...",                                          │
│      filename: "security_logs.xlsx",                                │
│      s3_key: "datasets/user123/security_logs.xlsx",                 │
│      status: "uploaded"                                             │
│    }                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. ANALYSIS SESSION STARTED                                         │
│    Collection: analysis_sessions                                    │
│    {                                                                │
│      dataset_id: "673abcd...",                                      │
│      status: "parsing",                                             │
│      progress: 10,                                                  │
│      current_step: "Parsing Excel file..."                          │
│    }                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. EXCEL PARSED (excel_parser.py)                                  │
│    Updates dataset:                                                 │
│    {                                                                │
│      status: "parsed",                                              │
│      parsed_data: {...},                                            │
│      sheet_count: 3,                                                │
│      total_rows: 15000                                              │
│    }                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. AUTOENCODER DETECTS ANOMALIES                                    │
│    For each anomalous row, creates entry in:                        │
│    Collection: anomalies                                            │
│    {                                                                │
│      dataset_id: "673abcd...",                                      │
│      anomaly_score: 0.87,                                           │
│      row_index: 1523,                                               │
│      sheet_name: "Access Logs",                                     │
│      raw_data: {user_id: "john.doe", records: 15000, ...},          │
│      anomalous_features: [                                          │
│        {feature_name: "records_accessed", deviation: "+300x"}       │
│      ],                                                             │
│      status: "detected"                                             │
│    }                                                                │
│    (Creates multiple anomaly documents, one per detected row)       │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. ANOMALY REPORTS CREATED                                          │
│    For each anomaly, create placeholder report:                     │
│    Collection: anomaly_reports                                      │
│    {                                                                │
│      dataset_id: "673abcd...",                                      │
│      anomaly_id: "673def...",                                       │
│      status: "pending_triage",                                      │
│      triage: null  // Will be filled by Foundation-Sec-8B           │
│    }                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. FOUNDATION-SEC-8B TRIAGE (for each anomaly)                      │
│    Updates anomaly_reports with triage analysis:                    │
│    {                                                                │
│      anomaly_id: "673def...",                                       │
│      status: "triaged",                                             │
│      triage: {                                                      │
│        severity: "critical",                                        │
│        severity_score: 9.2,                                         │
│        reasoning: ["Large-scale data access", ...],                 │
│        threat_context: {                                            │
│          threat_type: "Data Exfiltration - Insider Threat",         │
│          mitre_tactics: ["TA0010", "TA0009"],                       │
│          indicators_of_compromise: [...]                            │
│        },                                                           │
│        impact: {                                                    │
│          affected_records: 15000,                                   │
│          estimated_cost: "$2,475,000",                              │
│          compliance_violations: ["GDPR", "HIPAA"]                   │
│        },                                                           │
│        immediate_actions: [                                         │
│          {                                                          │
│            priority: 1,                                             │
│            action: "Suspend user account immediately",              │
│            command: "aws iam update-login-profile...",              │
│            rationale: "Prevent further data access"                 │
│          }                                                          │
│        ],                                                           │
│        confidence: {                                                │
│          overall_confidence: 0.94,                                  │
│          requires_human_review: false                               │
│        }                                                            │
│      },                                                             │
│      triaged_at: "2025-11-06T14:32:42Z"                             │
│    }                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. USER VIEWS REPORTS IN DASHBOARD                                 │
│    GET /api/anomaly-reports?status=triaged                          │
│    Returns:                                                         │
│    [                                                                │
│      {                                                              │
│        id: "673xyz...",                                             │
│        dataset_filename: "security_logs.xlsx",                      │
│        severity: "critical",                                        │
│        anomaly_score: 0.87,                                         │
│        threat_type: "Data Exfiltration",                            │
│        status: "triaged"                                            │
│      }                                                              │
│    ]                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 9. USER TAKES ACTION                                                │
│    PATCH /api/anomaly-reports/{report_id}                           │
│    {                                                                │
│      status: "under_review",                                        │
│      assigned_to: "security-team@hospital.sg",                      │
│      resolution_notes: "Investigating with IT team"                 │
│    }                                                                │
└───────────────────────────┬─────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 10. EXPORT TO PDF/EXCEL                                             │
│     GET /api/anomaly-reports/{report_id}/export?format=pdf          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Schema Relationships

### Entity Relationship Diagram

```
users (1) ──────── (∞) datasets
                       │
                       │ (1)
                       │
                       ├── (∞) anomalies
                       │      │
                       │      │ (1)
                       │      │
                       │      └── (1) anomaly_reports
                       │
                       └── (1) analysis_sessions
```

### Foreign Key Relationships

| Child Collection       | Parent Collection | Foreign Key Field | Relationship |
|------------------------|-------------------|-------------------|--------------|
| `datasets`             | `users`           | `user_id`         | Many-to-One  |
| `anomalies`            | `datasets`        | `dataset_id`      | Many-to-One  |
| `anomalies`            | `users`           | `user_id`         | Many-to-One  |
| `anomaly_reports`      | `datasets`        | `dataset_id`      | Many-to-One  |
| `anomaly_reports`      | `anomalies`       | `anomaly_id`      | One-to-One   |
| `anomaly_reports`      | `users`           | `user_id`         | Many-to-One  |
| `analysis_sessions`    | `datasets`        | `dataset_id`      | One-to-One   |
| `analysis_sessions`    | `users`           | `user_id`         | Many-to-One  |

---

## Collection Schemas

### 1. users (KEPT - No Changes)
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "username": "johndoe",
  "hashed_password": "...",
  "disabled": false,
  "is_admin": false
}
```

**Indexes:**
- `username` (unique)
- `email` (unique)

---

### 2. datasets (NEW)
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,  // FK to users
  "filename": "security_logs_nov2025.xlsx",
  "original_filename": "Security Logs Nov 2025.xlsx",
  "s3_key": "datasets/user123/security_logs_nov2025.xlsx",
  "file_size": 2048576,
  "content_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  "parsed_data": {
    "workbookMeta": {...},
    "sheets": [...]
  },
  "sheet_count": 3,
  "total_rows": 15000,

  "status": "parsed",  // uploaded, parsing, parsed, analyzing, completed, error

  "uploaded_at": ISODate("2025-11-06T12:00:00Z"),
  "parsed_at": ISODate("2025-11-06T12:01:30Z")
}
```

**Indexes:**
- `user_id`
- `status`
- `uploaded_at`
- `(user_id, filename)` (compound)

**Query Patterns:**
```javascript
// Get all datasets for user
db.datasets.find({user_id: "673abc..."}).sort({uploaded_at: -1})

// Get datasets by status
db.datasets.find({user_id: "673abc...", status: "parsed"})
```

---

### 3. anomalies (NEW)
```json
{
  "_id": ObjectId,
  "dataset_id": ObjectId,  // FK to datasets
  "user_id": ObjectId,     // FK to users (denormalized for fast queries)

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

  "status": "triaged",  // detected, triaging, triaged, reviewing, resolved, false_positive

  "detected_at": ISODate("2025-11-06T14:30:00Z"),
  "triaged_at": ISODate("2025-11-06T14:32:00Z")
}
```

**Indexes:**
- `dataset_id`
- `user_id`
- `status`
- `anomaly_score`
- `detected_at`
- `(dataset_id, row_index)` (compound)

**Query Patterns:**
```javascript
// Get all anomalies for dataset
db.anomalies.find({dataset_id: "673abcd..."}).sort({anomaly_score: -1})

// Get high-severity anomalies
db.anomalies.find({user_id: "673abc...", anomaly_score: {$gte: 0.8}})

// Get anomalies by status
db.anomalies.find({dataset_id: "673abcd...", status: "detected"})
```

---

### 4. anomaly_reports (NEW)
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,     // FK to users
  "dataset_id": ObjectId,  // FK to datasets
  "anomaly_id": ObjectId,  // FK to anomalies (unique - one report per anomaly)

  "triage": {
    "severity": "critical",  // low, medium, high, critical
    "severity_score": 9.2,
    "reasoning": [
      "Large-scale biometric data access detected",
      "Access from known threat actor region",
      "Outside business hours indicates unauthorized activity"
    ],

    "threat_context": {
      "threat_type": "Data Exfiltration - Insider Threat",
      "attack_stage": "Exfiltration (Stage 6 of 7)",
      "mitre_tactics": ["TA0010", "TA0009"],
      "indicators_of_compromise": [
        "Unusual geographic access (Russia, known APT28 infrastructure)",
        "Time-based anomaly (3am vs normal 9am-5pm)"
      ],
      "likely_attribution": "APT28 (Fancy Bear) infrastructure"
    },

    "impact": {
      "affected_records": 15000,
      "data_type": "Biometric PII",
      "estimated_cost": "$2,475,000",
      "compliance_violations": ["GDPR", "HIPAA", "PDPA"],
      "regulatory_fine_risk": "Up to $5,000,000"
    },

    "immediate_actions": [
      {
        "priority": 1,
        "action": "Suspend user account immediately",
        "command": "aws iam update-login-profile --user-name john.doe --no-password-reset-required",
        "rationale": "Prevent further data access while investigating",
        "estimated_time": "< 1 minute",
        "automation_available": true
      }
    ],
    "short_term_actions": [...],
    "long_term_actions": [...],

    "forensic_data": {
      "preserve_immediately": [
        "Database query logs (2025-11-06 02:00 - 04:00 UTC)",
        "Network packet captures from source IP"
      ]
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
    "generated_at": ISODate("2025-11-06T14:32:42Z"),
    "processing_time_seconds": 24.3
  },

  "status": "triaged",  // pending_triage, triaged, under_review, resolved, false_positive

  "assigned_to": "security-team@hospital.sg",
  "resolution_notes": "Account suspended. Investigating with IT forensics team.",
  "user_feedback": null,

  "created_at": ISODate("2025-11-06T14:30:00Z"),
  "triaged_at": ISODate("2025-11-06T14:32:42Z"),
  "reviewed_at": ISODate("2025-11-06T15:00:00Z"),
  "resolved_at": null
}
```

**Indexes:**
- `user_id`
- `dataset_id`
- `anomaly_id` (unique)
- `status`
- `created_at`
- `(user_id, status)` (compound)

**Query Patterns:**
```javascript
// Get all reports for user, sorted by severity
db.anomaly_reports.find({user_id: "673abc..."}).sort({"triage.severity_score": -1})

// Get pending reports
db.anomaly_reports.find({user_id: "673abc...", status: "triaged"})

// Get reports for dataset
db.anomaly_reports.find({dataset_id: "673abcd..."})

// Get critical alerts
db.anomaly_reports.find({
  user_id: "673abc...",
  "triage.severity": "critical"
})
```

---

### 5. analysis_sessions (NEW)
```json
{
  "_id": ObjectId,
  "user_id": ObjectId,      // FK to users
  "dataset_id": ObjectId,   // FK to datasets (unique - one session per dataset)

  "status": "triaging",  // initializing, parsing, detecting, triaging, completed, error
  "progress": 75,
  "current_step": "Performing triage analysis (15/20 anomalies)...",

  "total_rows_analyzed": 15000,
  "anomalies_detected": 20,
  "reports_generated": 15,

  "error_message": null,

  "started_at": ISODate("2025-11-06T14:30:00Z"),
  "completed_at": null,
  "processing_time_seconds": null
}
```

**Indexes:**
- `user_id`
- `dataset_id` (unique)
- `status`
- `started_at`

**Query Patterns:**
```javascript
// Get session for dataset
db.analysis_sessions.findOne({dataset_id: "673abcd..."})

// Get active sessions for user
db.analysis_sessions.find({
  user_id: "673abc...",
  status: {$in: ["parsing", "detecting", "triaging"]}
})
```

---

## Data Access Patterns

### Repository Pattern

All database operations go through repository layer:

```python
# app/repositories/anomaly_repo.py

# Dataset operations
create_dataset(user_id, filename, s3_key, file_size, content_type)
get_dataset(dataset_id, current_user)
get_user_datasets(current_user, status, limit)
update_dataset_status(dataset_id, status, parsed_data, sheet_count, total_rows)
delete_dataset(dataset_id, current_user)

# Anomaly operations
create_anomaly(dataset_id, user_id, anomaly_score, row_index, sheet_name, raw_data, anomalous_features)
get_anomaly(anomaly_id, current_user)
get_dataset_anomalies(dataset_id, current_user, status, min_score)
update_anomaly_status(anomaly_id, status)

# Report operations
create_anomaly_report(user_id, dataset_id, anomaly_id)
get_anomaly_report(report_id, current_user)
get_user_reports(current_user, status, dataset_id, limit)
update_anomaly_report(report_id, current_user, update_data)
add_triage_to_report(report_id, triage_data)
delete_anomaly_report(report_id, current_user)

# Session operations
create_analysis_session(user_id, dataset_id)
get_analysis_session(session_id, current_user)
get_session_by_dataset(dataset_id, current_user)
update_session_progress(session_id, status, progress, current_step, anomalies_detected, error_message)

# Analytics
get_user_statistics(current_user)
```

---

## Migration Strategy

### Removing Old Collections

To clean up old case study data:

```python
# Run this in development only
from app.database.connection import db

# Drop old collections
db.cases.drop()
db.documents.drop()
db.chunks.drop()
db.reports.drop()
db.report_progress.drop()
db.slides.drop()

print("Old collections removed. New schema ready.")
```

### Keeping User Authentication

The `users` collection remains unchanged, so existing user accounts will continue to work.

---

## Performance Considerations

### Indexes Created

All indexes are automatically created by `create_indexes()` in `connection.py`:

```python
# Dataset indexes
datasets: user_id, status, uploaded_at, (user_id + filename)

# Anomaly indexes
anomalies: dataset_id, user_id, status, anomaly_score, detected_at, (dataset_id + row_index)

# Report indexes
anomaly_reports: user_id, dataset_id, anomaly_id (unique), status, created_at, (user_id + status)

# Session indexes
analysis_sessions: user_id, dataset_id (unique), status, started_at
```

### Query Optimization

**Common queries are optimized:**

1. **Get user's recent reports** (uses `user_id` + `created_at` indexes)
2. **Get anomalies by severity** (uses `anomaly_score` index)
3. **Track session progress** (uses `dataset_id` unique index)
4. **Filter by status** (all collections have `status` index)

---

## API Endpoints (Preview)

```
# Datasets
POST   /api/datasets/upload
GET    /api/datasets
GET    /api/datasets/{dataset_id}
DELETE /api/datasets/{dataset_id}

# Anomalies
GET    /api/datasets/{dataset_id}/anomalies
GET    /api/anomalies/{anomaly_id}

# Reports
GET    /api/anomaly-reports
GET    /api/anomaly-reports/{report_id}
PATCH  /api/anomaly-reports/{report_id}
DELETE /api/anomaly-reports/{report_id}
GET    /api/anomaly-reports/{report_id}/export

# Sessions
GET    /api/analysis-sessions/{session_id}
GET    /api/datasets/{dataset_id}/session

# Statistics
GET    /api/statistics
```

---

## Summary

**New Schema Benefits:**
1. ✅ Clean separation of concerns (datasets → anomalies → reports)
2. ✅ Efficient queries with proper indexes
3. ✅ Real-time progress tracking via sessions
4. ✅ Rich triage data from Foundation-Sec-8B
5. ✅ User authentication preserved
6. ✅ Scalable for large datasets (indexed by dataset_id)

**Next Steps:**
1. Create API routes using these repositories
2. Implement Excel upload endpoint
3. Build autoencoder detection pipeline
4. Integrate Foundation-Sec-8B triage
5. Create frontend dashboard to display reports
