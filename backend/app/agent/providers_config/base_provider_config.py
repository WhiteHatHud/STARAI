from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class ProviderConfig:
    """Base configuration for a provider."""
    api_key: str
    model: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = None


class BaseProviderConfig(ABC):
    """Abstract base class for provider-specific configurations."""
    
    def __init__(self, env_config: Dict[str, Any]):
        self.env_config = env_config
        self._validate_environment()
    
    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name."""
        pass
    
    @property
    @abstractmethod
    def api_key_name(self) -> str:
        """Return the environment variable name for API key."""
        pass
    
    @property
    @abstractmethod
    def provider_class(self):
        """Return the LangChain provider class."""
        pass
    
    def _validate_environment(self) -> None:
        """Validate required environment variables."""
        api_key = self.env_config.get(self.api_key_name)
        if not api_key:
            raise ValueError(
                f"{self.api_key_name} not found in environment configuration. "
                f"Please add it to your .env.local file."
            )
    
    def get_api_key(self) -> str:
        """Get API key from environment."""
        return self.env_config.get(self.api_key_name)
    
    @abstractmethod
    def build_params(self, model_id: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """Build provider-specific initialization parameters."""
        pass
    
    def get_provider_instance(self, model_id: str, config: Dict[str, Any]):
        """
        Create and return provider instance.
        
        Args:
            model_id: Model identifier
            config: Model configuration
            
        Returns:
            Initialized provider instance
        """
        params = self.build_params(model_id, config)
        
        # Log params (without exposing sensitive data)
        safe_params = self._sanitize_params(params)
        logger.info(f"Initializing {self.provider_name} with params: {safe_params}")
        
        return self.provider_class(**params)
    
    def _sanitize_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive data from params for logging."""
        return {
            k: v for k, v in params.items() 
            if "key" not in k.lower() and "endpoint" not in k.lower()
        }