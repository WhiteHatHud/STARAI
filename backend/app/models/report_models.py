#report_models.py
from datetime import datetime, timezone
from typing import Annotated, Any, Dict, List, Optional, Literal
from enum import Enum
from pydantic import BaseModel, BeforeValidator, Field, field_validator
from bson import ObjectId

def validate_object_id(id_value):
    if not id_value:
        return None
    
    # If it's a temporary ID, generate a new ObjectId
    if isinstance(id_value, str) and id_value.startswith("temp_"):
        return str(ObjectId())
    
    # If it's already a valid ObjectId, use it
    if isinstance(id_value, str):
        try:
            return str(ObjectId(id_value))
        except:
            # Fall back to generating a new ID
            return str(ObjectId())
            
    # Default case
    return str(ObjectId())

PyObjectId = Annotated[str, BeforeValidator(validate_object_id)]

class ExplanationModel(BaseModel):
    """Detailed explanation for an answer"""
    evidence: List[str] = Field(default_factory=list, description="Evidence quotes supporting the answer")
    reasoning: str = Field(..., description="Reasoning process for arriving at the answer")
    confidence: float = Field(..., description="Confidence score (1-5)")
    retrieval_quality: Optional[float] = Field(None, description="Average retrieval score")
    system_confidence: Optional[float] = Field(None, description="System-calculated confidence")
    sources: Optional[List[Dict[str, Any]]] = Field(None, description="Source documents used")
    processing_steps: Optional[List[Dict[str, Any]]] = Field(None, description="Processing pipeline steps")
    
class ReportMetrics(BaseModel):
    """Metrics for report generation"""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    processing_time_seconds: Optional[float] = None
    question_count: int = 0
    answered_count: int = 0
    overall_confidence: float = 0.0
    low_confidence_count: int = 0
    evidence_count: int = 0

# Add a study type enum
class StudyType(str, Enum):
    STYLE_A = "style_a"
    STYLE_B = "style_b"
    STYLE_C = "style_c"
    STYLE_SOF = "style_sof"
    STYLE_A_SINGLE = "single_section"
    STYLE_CUSTOM = "style_custom"
    HBS = "hbs_full"
    DOCUMENT_UPLOAD = "document_upload"
    CUSTOM_TEMPLATE = "custom_template"
    

class ReportSection(BaseModel):
    """A section of a case study with explainability"""
    section_id: str = Field(..., pattern="^[a-z0-9_]+$")
    title: str
    content: str
    explanation: Optional[ExplanationModel] = None  # Reuse explanation structure
    enhanced: bool = False
    # Add additional fields for style_b, style_c, and style_sof studies
    learning_objectives: Optional[List[str]] = None  # For style_b studies
    discussion_questions: Optional[List[str]] = None  # For style_b studies
    interactive_elements: Optional[Dict[str, Any]] = None  # For style_c and style_sof studies
    assessment_content: Optional[Dict[str, Any]] = None  # For style_c and style_sof studies
    style_sof_elements: Optional[Dict[str, Any]] = None  # For style_sof studies
    content_type: Optional[str] = None  # For custom sections, e.g., "content", "structural", "formatting"
    formatting: Optional[List[str]] = None  # For custom sections, e.g., ["bold", "italic", "underline"]

class ReportMetadata(BaseModel):
    """Enhanced metadata with reused metrics"""
    document_count: int = 0
    generation_metrics: ReportMetrics = Field(default_factory=ReportMetrics)  # Reuse metrics
    coherence_scores: Dict[str, float] = Field(default_factory=dict)
    enhancement_history: List[Dict[str, Any]] = Field(default_factory=list)
    # Add specific metadata for different study types
    teaching_notes: Optional[Dict[str, Any]] = None  # For style_b studies
    multimedia_elements: Optional[List[Dict[str, Any]]] = None  # For style_c and style_sof studies
    interactive_features: Optional[Dict[str, Any]] = None  # For style_c and style_sof studies
    style_sof_features: Optional[Dict[str, Any]] = None  # For style_sof studies

class ReportBase(BaseModel):
    """Base model with common fields"""
    title: str
    case_id: PyObjectId
    document_ids: List[PyObjectId] = Field(default_factory=list)
    status: Literal["draft", "processing", "pending_review", "published", "error"] = "draft"
    # Add the study type field
    study_type: StudyType

class ReportCreate(ReportBase):
    """Creation model with validation"""
    study_type: StudyType
    single_section: Optional[bool] = False  
    template_name: Optional[str] = None  
    @field_validator('title')
    def validate_title(cls, v):
        if len(v) < 10:
            raise ValueError("Title must be at least 10 characters")
        return v

class ReportModel(ReportBase):
    """Full case study model with inherited properties"""
    id: Optional[PyObjectId] = Field(alias="_id", default_factory=lambda: str(ObjectId()))
    user_id: PyObjectId
    sections: List[ReportSection] = Field(default_factory=list)
    metadata: ReportMetadata = Field(default_factory=ReportMetadata)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    template_name: Optional[str] = None
    header: Optional[Dict] = None 
    footer: Optional[Dict] = None 
    # progress time
    processing_time: Optional[float] = None  # Processing time in seconds
    processing_start_time: Optional[datetime] = None
    processing_end_time: Optional[datetime] = None
    def update_timestamp(self):
        self.updated_at = datetime.now(timezone.utc)

class ReportProgressUpdate(BaseModel):
    """Unified progress model compatible with report updates"""
    progress_id: str
    status: Literal["initializing", "processing", "completed", "error"]
    progress: int = Field(..., ge=0, le=100)
    message: str
    report_id: Optional[PyObjectId] = None
    error: Optional[str] = None
    study_type: Optional[StudyType] = None
    template: Optional[str] = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    report_title: Optional[str] = None
    doc_id: Optional[str] = None  

class FeedbackItem(BaseModel):
    highlighted_text: str
    feedback: str

class RegenerateFeedbackRequest(BaseModel):
    feedback_items: List[FeedbackItem]

# Edit a section of a case study
class SectionUpdateRequest(BaseModel):
    content: str
