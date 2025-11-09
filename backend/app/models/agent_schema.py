from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)

class ModelCreate(BaseModel):
    """Schema for creating a new model."""
    model_id: str = Field(..., description="Unique model identifier")
    provider: str = Field(..., description="Provider name (gemini, openai, anthropic, huggingface)")
    system_prompt: bool = Field(True, description="Whether model supports system prompts")
    base_url: Optional[str] = Field(None, description="Base URL for the provider API")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature setting")
    max_tokens: Optional[int] = Field(None, gt=0, description="Maximum tokens")


class ModelUpdate(BaseModel):
    """Schema for updating a model."""
    provider: Optional[str] = None
    system_prompt: Optional[bool] = None
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(None, gt=0)


class ModelInfo(BaseModel):
    """Schema for model response."""
    model_id: str
    provider: str
    system_prompt: bool
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class AgentRunRequest(BaseModel):
    """Schema for agent run request."""
    model_id: str = Field(..., description="Model identifier to use")
    prompt: str = Field(..., description="User prompt/question")
    system: Optional[str] = Field(None, description="Optional system prompt override")
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature setting")
    max_tokens: Optional[int] = Field(None, gt=0, description="Maximum tokens to generate")
    max_new_tokens: Optional[int] = Field(None, gt=0, description="Maximum new tokens (HuggingFace)")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p sampling")
    repetition_penalty: Optional[float] = Field(None, ge=1.0, le=2.0, description="Repetition penalty")
    
    class Config:
        json_schema_extra = {
            "example": {
                "model_id": "gemini-2.5-flash",
                "prompt": "What is SOLID principle in software engineering?",
                "system": "You are an expert software engineer",
                "temperature": 0.7
            }
        }


class AgentRunResponse(BaseModel):
    """Schema for agent run response."""
    model_id: str = Field(..., description="Model used")
    prompt: str = Field(..., description="Original prompt")
    response: str = Field(..., description="Generated response")
    provider: str = Field(..., description="Provider used")
    
    class Config:
        json_schema_extra = {
            "example": {
                "model_id": "gemini-2.5-flash",
                "prompt": "What is SOLID?",
                "response": "SOLID is an acronym for five design principles...",
                "provider": "gemini"
            }
        }