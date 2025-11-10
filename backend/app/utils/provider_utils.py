from typing import Dict, Any, Tuple, Type
from app.agent.providers_config.provider_factory import ProviderConfigFactory
import logging

logger = logging.getLogger(__name__)


class ProviderUtils:
    """
    Facade for provider configuration management.
    Provides simplified interface to provider configurations.
    """
    
    def __init__(self, env_config: Dict[str, Any]):
        """
        Initialize provider utils.
        
        Args:
            env_config: Environment configuration dictionary
        """
        self.env_config = env_config
    
    def get_provider_instance(
        self, 
        provider_name: str, 
        model_id: str, 
        config: Dict[str, Any]
    ):
        """
        Get initialized provider instance.
        
        Args:
            provider_name: Name of the provider
            model_id: Model identifier
            config: Model configuration
            
        Returns:
            Initialized provider instance
        """
        provider_config = ProviderConfigFactory.create_config(provider_name, self.env_config)
        return provider_config.get_provider_instance(model_id, config)
    
    def get_supported_providers(self) -> list[str]:
        """Get list of supported providers."""
        return ProviderConfigFactory.get_supported_providers()
    
    def is_provider_supported(self, provider_name: str) -> bool:
        """Check if a provider is supported."""
        return ProviderConfigFactory.is_provider_supported(provider_name)