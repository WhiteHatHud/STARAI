from typing import Type, Optional
from app.agent.providers import BaseProvider, LangChainProvider, HuggingFaceProvider
import logging

logger = logging.getLogger(__name__)


class ProviderRepository:
    """Repository for managing AI providers using dependency injection."""
    
    # Map provider names to their provider classes
    PROVIDER_REGISTRY: dict[str, Type[BaseProvider]] = {
        "huggingface": HuggingFaceProvider,
        "gemini": LangChainProvider,
        "azure": LangChainProvider,
        "openai": LangChainProvider,
    }
    
    def get_provider_class(self, provider_name: str) -> Optional[Type[BaseProvider]]:
        """
        Get provider class by name.
        
        Args:
            provider_name: Name of the provider
            
        Returns:
            Provider class or None if not found
        """
        provider_class = self.PROVIDER_REGISTRY.get(provider_name)
        
        if provider_class:
            logger.debug(f"Retrieved provider class for: {provider_name}")
        else:
            logger.warning(f"Provider '{provider_name}' not found in registry")
        
        return provider_class
    
    def get_provider_list(self) -> list[str]:
        """Get list of all available providers."""
        return list(self.PROVIDER_REGISTRY.keys())
    
    def is_supported(self, provider_name: str) -> bool:
        """Check if a provider is supported."""
        return provider_name in self.PROVIDER_REGISTRY