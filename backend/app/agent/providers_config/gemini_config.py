from langchain_google_genai import ChatGoogleGenerativeAI
from .base_provider_config import BaseProviderConfig 
from typing import Dict, Any


class GeminiProviderConfig(BaseProviderConfig):
    """Configuration for Google Gemini provider."""
    
    @property
    def provider_name(self) -> str:
        return "gemini"
    
    @property
    def api_key_name(self) -> str:
        return "GEMINI_API_KEY"
    
    @property
    def provider_class(self):
        return ChatGoogleGenerativeAI
    
    def build_params(self, model_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Build Gemini-specific parameters."""
        return {
            "model": model_id,
            "google_api_key": self.get_api_key(),
            "temperature": config.get("temperature", 0.7),
            "max_output_tokens": config.get("max_output_tokens"),
        }