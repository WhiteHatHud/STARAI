from .base_provider_config import BaseProviderConfig
from .gemini_config import GeminiProviderConfig
from .openai_config import OpenAIProviderConfig
from .azure_config import AzureProviderConfig
from typing import Dict, Type, Any
import logging

logger = logging.getLogger(__name__)


class ProviderConfigFactory:
    """Factory for creating provider configurations."""
    
    _registry: Dict[str, Type[BaseProviderConfig]] = {
        "gemini": GeminiProviderConfig,
        "openai": OpenAIProviderConfig,
        "azure": AzureProviderConfig,
    }
    
    @classmethod
    def create_config(
        cls, 
        provider_name: str, 
        env_config: Dict[str, Any]
    ) -> BaseProviderConfig:
        """
        Create a provider configuration instance.
        
        Args:
            provider_name: Name of the provider
            env_config: Environment configuration
            
        Returns:
            Provider configuration instance
            
        Raises:
            ValueError: If provider not found
        """
        config_class = cls._registry.get(provider_name)
        
        if not config_class:
            raise ValueError(
                f"Provider '{provider_name}' not supported. "
                f"Available providers: {cls.get_supported_providers()}"
            )
        
        return config_class(env_config)
    
    @classmethod
    def get_supported_providers(cls) -> list[str]:
        """Get list of supported provider names."""
        return list(cls._registry.keys())
    
    @classmethod
    def is_provider_supported(cls, provider_name: str) -> bool:
        """Check if a provider is supported."""
        return provider_name in cls._registry