from langchain_openai import AzureChatOpenAI
from .base_provider_config import BaseProviderConfig 
from typing import Dict, Any

class AzureProviderConfig(BaseProviderConfig):
    """Configuration for Azure OpenAI provider."""
    
    @property
    def provider_name(self) -> str:
        return "azure"
    
    @property
    def api_key_name(self) -> str:
        return "AZURE_OPENAI_API_KEY"
    
    @property
    def provider_class(self):
        return AzureChatOpenAI
    
    def _validate_environment(self) -> None:
        """Validate Azure-specific environment variables."""
        super()._validate_environment()
        
        required_vars = [
            "AZURE_OPENAI_ENDPOINT",
            "AZURE_OPENAI_API_VERSION"
        ]
        
        missing = [var for var in required_vars if not self.env_config.get(var)]
        if missing:
            raise ValueError(
                f"Missing required Azure environment variables: {', '.join(missing)}"
            )
    
    def build_params(self, model_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Build Azure-specific parameters."""
        params = {
            "api_key": self.get_api_key(),
            "azure_endpoint": self.env_config.get("AZURE_OPENAI_ENDPOINT"),
            "azure_deployment": model_id,  # For Azure, model_id is deployment name
            "api_version": self.env_config.get("AZURE_OPENAI_API_VERSION", "2024-02-15-preview"),
        }
        
        if "max_tokens" in config:
            params["max_tokens"] = config["max_tokens"]
        
        return params