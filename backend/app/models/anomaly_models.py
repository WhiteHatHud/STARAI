# app/models/anomaly_models.py
"""
Data models for anomaly detection and security triage system.
Replaces case study models with security-focused schemas.
"""

from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Optional, Literal
from enum import Enum
from pydantic import BaseModel, BeforeValidator, Field, field_validator
from bson import ObjectId


def validate_object_id(id_value):
    """Validate and convert ObjectId for Pydantic v2"""
    if not id_value:
        return None

    if isinstance(id_value, str) and id_value.startswith("temp_"):
        return str(ObjectId())

    if isinstance(id_value, str):
        try:
            return str(ObjectId(id_value))
        except:
            return str(ObjectId())

    return str(ObjectId())


PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]


# ============================================================================
# DATASET MODELS (Uploaded Excel files)
# ============================================================================

class DatasetStatus(str, Enum):
    """Status of uploaded dataset"""
    UPLOADED = "uploaded"  # File uploaded to S3 and MongoDB
    PARSING = "parsing"  # Parsing file structure
    PARSED = "parsed"  # File structure parsed
    ANALYZING = "analyzing"  # Running autoencoder analysis
    ANALYZED = "analyzed"  # Autoencoder complete, anomalies detected
    TRIAGING = "triaging"  # Running LLM triage analysis
    COMPLETED = "completed"  # All analysis complete
    ERROR = "error"  # Error occurred


class DatasetModel(BaseModel):
    """Represents an uploaded Excel dataset for anomaly detection"""
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))
    user_id: PyObjectId
    filename: str
    original_filename: str
    s3_key: str  # S3 storage location
    file_size: int  # Bytes
    content_type: str  # application/vnd.openxmlformats-officedocument.spreadsheetml.sheet

    # Parsed data structure
    parsed_data: Optional[Dict[str, Any]] = None  # Output from excel_parser.py
    sheet_count: int = 0
    total_rows: int = 0

    # Processing status
    status: DatasetStatus = DatasetStatus.UPLOADED
    anomaly_count: int = 0  # Number of anomalies detected
    progress: int = 0  # Progress percentage (0-100) for polling
    error: Optional[str] = None  # Error message if status is 'error'

    # Timestamps
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    parsed_at: Optional[datetime] = None
    analyzed_at: Optional[datetime] = None  # When autoencoder analysis completed
    triaged_at: Optional[datetime] = None  # When LLM triage completed

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "by_alias": False,  # Use field names, not aliases in responses
        "json_schema_extra": {
            "example": {
                "id": "673abcd1234567890abcdef0",
                "user_id": "673abc1234567890abcdef1",
                "filename": "security_logs_nov2025.xlsx",
                "s3_key": "datasets/user123/security_logs_nov2025.xlsx",
                "file_size": 2048576,
                "status": "parsed",
                "sheet_count": 3,
                "total_rows": 15000
            }
        }
    }


class DatasetCreate(BaseModel):
    """Request model for creating a dataset"""
    filename: str
    content_type: str


# ============================================================================
# ANOMALY DETECTION MODELS
# ============================================================================

class AnomalyStatus(str, Enum):
    """Status of detected anomaly"""
    DETECTED = "detected"
    TRIAGING = "triaging"
    TRIAGED = "triaged"
    REVIEWING = "reviewing"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class AnomalousFeature(BaseModel):
    """Individual feature that contributed to anomaly detection"""
    feature_name: str
    actual_value: Any
    expected_value: Optional[Any] = None
    deviation: str  # Human-readable explanation (e.g., "+300x usual volume")
    contribution_score: float = Field(..., ge=0, le=1)  # 0-1, how much this feature contributed


class DetectedAnomaly(BaseModel):
    """Single anomaly detected by autoencoder"""
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))
    dataset_id: PyObjectId
    user_id: PyObjectId

    # Detection details
    anomaly_score: float = Field(..., ge=0, le=1)  # Autoencoder confidence (0-1)
    row_index: int  # Which row in the Excel file
    sheet_name: str

    # Raw data that was flagged
    raw_data: Dict[str, Any]  # The actual row data from Excel

    # Feature analysis
    anomalous_features: List[AnomalousFeature] = Field(default_factory=list)

    # Processing status
    status: AnomalyStatus = AnomalyStatus.DETECTED

    # Timestamps
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    triaged_at: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "by_alias": False,  # Use field names, not aliases in responses
        "json_schema_extra": {
            "example": {
                "id": "673def1234567890abcdef2",
                "dataset_id": "673abcd1234567890abcdef0",
                "anomaly_score": 0.87,
                "row_index": 1523,
                "sheet_name": "Access Logs",
                "status": "detected",
                "raw_data": {
                    "user_id": "john.doe@hospital.sg",
                    "timestamp": "2025-11-06T03:15:22Z",
                    "records_accessed": 15000,
                    "source_ip": "185.220.101.42"
                }
            }
        }
    }


# ============================================================================
# TRIAGE ANALYSIS MODELS
# ============================================================================

class SeverityLevel(str, Enum):
    """Security threat severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class MitigationAction(BaseModel):
    """Individual mitigation step"""
    priority: int = Field(..., ge=1)  # 1 = highest priority
    action: str  # Human-readable description
    command: Optional[str] = None  # Optional CLI command to execute
    rationale: str  # Why this action is needed
    estimated_time: str  # e.g., "< 1 minute", "2 hours"
    automation_available: bool = False
    requires_manual_review: bool = False


class ImpactAssessment(BaseModel):
    """Business and compliance impact analysis"""
    affected_records: Optional[int] = None
    data_type: str  # e.g., "Biometric PII", "Financial records"
    estimated_cost: Optional[str] = None  # e.g., "$2,475,000"
    compliance_violations: List[str] = Field(default_factory=list)  # ["GDPR", "HIPAA", "PDPA"]
    regulatory_fine_risk: Optional[str] = None


class ThreatContext(BaseModel):
    """Contextual threat intelligence"""
    threat_type: str  # e.g., "Data Exfiltration - Insider Threat"
    attack_stage: Optional[str] = None  # MITRE ATT&CK stage
    mitre_tactics: List[str] = Field(default_factory=list)  # ["TA0010", "TA0009"]
    indicators_of_compromise: List[str] = Field(default_factory=list)
    likely_attribution: Optional[str] = None  # Threat actor if identifiable


class ConfidenceMetrics(BaseModel):
    """Confidence assessment for triage analysis"""
    overall_confidence: float = Field(..., ge=0, le=1)
    anomaly_detection_confidence: float = Field(..., ge=0, le=1)
    threat_classification_confidence: float = Field(..., ge=0, le=1)
    contextual_analysis_confidence: float = Field(..., ge=0, le=1)
    false_positive_probability: float = Field(..., ge=0, le=1)
    requires_human_review: bool = False


class TriageAnalysis(BaseModel):
    """Complete triage analysis from Foundation-Sec-8B"""

    # Severity assessment
    severity: SeverityLevel
    severity_score: float = Field(..., ge=0, le=10)
    reasoning: List[str] = Field(default_factory=list)

    # Threat classification
    threat_context: ThreatContext

    # Impact assessment
    impact: ImpactAssessment

    # Mitigation recommendations
    immediate_actions: List[MitigationAction] = Field(default_factory=list)
    short_term_actions: List[MitigationAction] = Field(default_factory=list)
    long_term_actions: List[MitigationAction] = Field(default_factory=list)

    # Evidence and forensics
    forensic_data: Dict[str, Any] = Field(default_factory=dict)

    # Confidence assessment
    confidence: ConfidenceMetrics

    # Historical context
    similar_incidents_count: int = 0
    historical_context: Optional[str] = None

    # AI model metadata
    generated_by: str = "Foundation-Sec-8B"
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processing_time_seconds: Optional[float] = None


# ============================================================================
# ANOMALY REPORT MODELS (Main output)
# ============================================================================

class ReportStatus(str, Enum):
    """Status of anomaly report"""
    PENDING_TRIAGE = "pending_triage"
    TRIAGED = "triaged"
    UNDER_REVIEW = "under_review"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class AnomalyReport(BaseModel):
    """Complete anomaly detection + triage report"""
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))
    user_id: PyObjectId
    dataset_id: PyObjectId

    # Detection reference
    anomaly_id: PyObjectId  # Reference to DetectedAnomaly

    # Triage analysis
    triage: Optional[TriageAnalysis] = None

    # Report metadata
    status: ReportStatus = ReportStatus.PENDING_TRIAGE

    # User actions
    assigned_to: Optional[str] = None  # Email or username
    resolution_notes: Optional[str] = None
    user_feedback: Optional[str] = None  # If marked false positive, why?

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    triaged_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "by_alias": False,  # Use field names, not aliases in responses
        "json_schema_extra": {
            "example": {
                "id": "673xyz1234567890abcdef3",
                "user_id": "673abc1234567890abcdef1",
                "dataset_id": "673abcd1234567890abcdef0",
                "anomaly_id": "673def1234567890abcdef2",
                "status": "triaged",
                "created_at": "2025-11-06T14:32:18Z"
            }
        }
    }


class AnomalyReportCreate(BaseModel):
    """Request model for creating anomaly report"""
    dataset_id: PyObjectId
    anomaly_id: PyObjectId


class AnomalyReportUpdate(BaseModel):
    """Request model for updating report status"""
    status: Optional[ReportStatus] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None
    user_feedback: Optional[str] = None


# ============================================================================
# ANALYSIS SESSION MODELS (Track processing state)
# ============================================================================

class SessionStatus(str, Enum):
    """Status of analysis session"""
    INITIALIZING = "initializing"
    PARSING = "parsing"
    DETECTING = "detecting"
    TRIAGING = "triaging"
    COMPLETED = "completed"
    ERROR = "error"


class AnalysisSession(BaseModel):
    """Tracks the entire analysis workflow for a dataset"""
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))
    user_id: PyObjectId
    dataset_id: PyObjectId

    # Progress tracking
    status: SessionStatus = SessionStatus.INITIALIZING
    progress: int = Field(default=0, ge=0, le=100)  # Percentage
    current_step: str = "Initializing..."

    # Statistics
    total_rows_analyzed: int = 0
    anomalies_detected: int = 0
    reports_generated: int = 0

    # Error handling
    error_message: Optional[str] = None

    # Timestamps
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    processing_time_seconds: Optional[float] = None

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "by_alias": False  # Use field names, not aliases in responses
    }


class SessionProgressUpdate(BaseModel):
    """Update model for session progress (for SSE/websockets)"""
    session_id: PyObjectId
    status: SessionStatus
    progress: int = Field(..., ge=0, le=100)
    current_step: str
    anomalies_detected: int = 0
    error_message: Optional[str] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============================================================================
# RESPONSE MODELS FOR API
# ============================================================================

class AnomalyReportSummary(BaseModel):
    """Lightweight summary for list views"""
    id: PyObjectId
    dataset_filename: str
    severity: Optional[SeverityLevel] = None
    anomaly_score: float
    status: ReportStatus
    created_at: datetime
    threat_type: Optional[str] = None


class DatasetSummary(BaseModel):
    """Lightweight dataset summary"""
    id: PyObjectId
    filename: str
    total_rows: int
    sheet_count: int
    status: DatasetStatus
    uploaded_at: datetime
    anomalies_detected: int = 0

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "by_alias": False  # Use field names, not aliases in responses
    }


# ============================================================================
# LLM EXPLANATION MODELS (Azure OpenAI Analysis)
# ============================================================================

class MitreTechnique(BaseModel):
    """MITRE ATT&CK technique mapping"""
    id: str  # e.g., "T1021.001"
    name: str  # e.g., "Remote Services: SSH"
    confidence: float = Field(..., ge=0.0, le=1.0)
    rationale: Optional[str] = None


class ActorInfo(BaseModel):
    """Information about the actor/user in the anomaly"""
    user_id: Optional[str] = None
    username: Optional[str] = None
    process_name: Optional[str] = None
    pid: Optional[int] = None
    ppid: Optional[int] = None


class HostInfo(BaseModel):
    """Host information for the anomaly"""
    hostname: Optional[str] = None
    mount_ns: Optional[str] = None


class EventArgument(BaseModel):
    """Argument in the system event"""
    name: str
    type: str
    value: str


class EventInfo(BaseModel):
    """System event details"""
    name: str  # Event name (e.g., "close", "security_inode_unlink")
    timestamp: Optional[str] = None
    args: List[EventArgument] = Field(default_factory=list)


class FeatureInfo(BaseModel):
    """Feature values from anomaly detector"""
    name: str
    value: float
    z: Optional[float] = None  # Z-score if applicable


class EvidenceReference(BaseModel):
    """Reference to source data"""
    type: Literal["row"] = "row"
    row_index: Optional[int] = None
    sheet: Optional[str] = None
    s3_key: Optional[str] = None


class TriageActions(BaseModel):
    """Triage recommendations from LLM"""
    immediate_actions: List[str] = Field(default_factory=list)
    short_term: List[str] = Field(default_factory=list)
    long_term: List[str] = Field(default_factory=list)


class ProvenanceInfo(BaseModel):
    """LLM call metadata"""
    model_name: str = "gpt-5-mini"
    model_version: str = "base"
    prompt_id: str = "beth-triage-v1"
    temperature: float = 0.2
    tokens_prompt: Optional[int] = None
    tokens_output: Optional[int] = None
    latency_ms: Optional[float] = None


class LLMExplanation(BaseModel):
    """
    LLM-generated explanation for an anomaly.
    Stored per anomaly after Azure OpenAI analysis.
    """
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))

    # Core identifiers
    schema_version: str = "1.0"
    dataset_id: PyObjectId
    anomaly_id: PyObjectId
    session_id: Optional[PyObjectId] = None

    # Verdict and severity
    verdict: Literal["suspicious", "likely_malicious", "unclear"]
    severity: Literal["low", "medium", "high", "critical"]
    confidence_label: Literal["low", "medium", "high"]
    confidence_score: float = Field(..., ge=0.0, le=1.0)

    # MITRE ATT&CK mappings
    mitre: List[MitreTechnique] = Field(default_factory=list)

    # Context
    actors: ActorInfo
    host: HostInfo
    event: EventInfo
    features: List[FeatureInfo] = Field(default_factory=list)
    evidence_refs: List[EvidenceReference] = Field(default_factory=list)

    # Analysis
    key_indicators: List[str] = Field(default_factory=list)
    triage: TriageActions
    notes: str

    # Status tracking
    status: Literal["new", "reviewed", "escalated", "resolved", "false_positive"] = "new"
    owner: Optional[str] = None

    # Metadata
    provenance: ProvenanceInfo
    hash: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), alias="_created_at")
    llm_timestamp_utc: Optional[str] = Field(default=None, alias="_llm_timestamp_utc")

    model_config = {
        "populate_by_name": True,
        "json_encoders": {ObjectId: str},
        "by_alias": False,  # Use field names, not aliases in responses
        "json_schema_extra": {
            "example": {
                "schema_version": "1.0",
                "dataset_id": "673abc1234567890abcdef1",
                "anomaly_id": "673abc1234567890abcdef2",
                "verdict": "suspicious",
                "severity": "medium",
                "confidence_label": "medium",
                "confidence_score": 0.6,
                "notes": "SSH daemon performed suspicious file operations"
            }
        }
    }
