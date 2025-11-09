from typing import Type, Optional
from app.agent.providers.base_provider import BaseProvider
from app.agent.providers.langchain_provider import LangChainProvider
from app.agent.providers.huggingface_provider import HuggingFaceProvider
import logging

logger = logging.getLogger(__name__)


class ProviderRepository:
    """Repository for managing AI providers using dependency injection."""
    
    # Map provider names to their provider classes
    PROVIDER_REGISTRY: dict[str, Type[BaseProvider]] = {
        "huggingface": HuggingFaceProvider,
        "gemini": LangChainProvider,
        "openai": LangChainProvider,
        "anthropic": LangChainProvider,
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
    
    def register_provider(self, provider_name: str, provider_class: Type[BaseProvider]) -> None:
        """
        Register a new provider dynamically.
        
        Args:
            provider_name: Name of the provider
            provider_class: Provider class (must inherit from BaseProvider)
        """
        if not issubclass(provider_class, BaseProvider):
            raise TypeError(f"{provider_class} must inherit from BaseProvider")
        
        self.PROVIDER_REGISTRY[provider_name] = provider_class
        logger.info(f"Registered new provider: {provider_name}")