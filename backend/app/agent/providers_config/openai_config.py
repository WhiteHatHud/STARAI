from langchain_openai import ChatOpenAI
from .base_provider_config import BaseProviderConfig 
from typing import Dict, Any

class OpenAIProviderConfig(BaseProviderConfig):
    """Configuration for OpenAI provider."""
    
    @property
    def provider_name(self) -> str:
        return "openai"
    
    @property
    def api_key_name(self) -> str:
        return "OPENAI_API_KEY"
    
    @property
    def provider_class(self):
        return ChatOpenAI
    
    def build_params(self, model_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Build OpenAI-specific parameters."""
        params = {
            "model": model_id,
            "api_key": self.get_api_key(),
            "temperature": config.get("temperature", 0.7),
        }
        
        if "max_tokens" in config:
            params["max_tokens"] = config["max_tokens"]
        
        return params