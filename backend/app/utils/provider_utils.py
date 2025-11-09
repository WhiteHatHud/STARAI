from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from typing import Dict, Tuple, Type, Any
import logging

logger = logging.getLogger(__name__)


class ProviderUtils:
    """Utility class for managing LangChain provider configurations."""
    
    PROVIDER_MAP: Dict[str, Dict[str, Any]] = {
        "gemini": {
            "class": ChatGoogleGenerativeAI,
            "api_key_name": "GEMINI_API_KEY",
            "api_key_param": "google_api_key"  # Fixed: Add parameter name
        },
        "openai": {
            "class": ChatOpenAI,
            "api_key_name": "OPENAI_API_KEY",
            "api_key_param": "api_key"
        },
        "anthropic": {
            "class": ChatAnthropic,
            "api_key_name": "ANTHROPIC_API_KEY",
            "api_key_param": "api_key"
        }
    }

    @staticmethod
    def get_provider_class(provider_name: str, env_config: dict) -> Tuple[Type, Dict[str, Any]]:
        """
        Get provider class and initialization parameters.
        
        Args:
            provider_name: Name of the provider (gemini, openai, anthropic)
            env_config: Environment configuration dictionary
            
        Returns:
            Tuple of (provider_class, initialization_params)
            
        Raises:
            ValueError: If provider not supported or API key not found
        """
        provider_info = ProviderUtils.PROVIDER_MAP.get(provider_name)
        
        if not provider_info:
            raise ValueError(
                f"Provider '{provider_name}' not supported. "
                f"Available providers: {list(ProviderUtils.PROVIDER_MAP.keys())}"
            )
        
        # Get API key
        api_key_name = provider_info["api_key_name"]
        api_key = env_config.get(api_key_name)
        
        if not api_key:
            raise ValueError(
                f"{api_key_name} not found in environment configuration. "
                f"Please add it to your .env.local file."
            )
        
        # Build default parameters with correct API key parameter name
        api_key_param = provider_info["api_key_param"]
        params = {
            "model": None,  # To be set by caller
            api_key_param: api_key, 
            "temperature": 0.7,
        }
        
        # Add provider-specific defaults
        if provider_name == "gemini":
            params["max_output_tokens"] = None
        
        logger.info(f"Retrieved provider class and params for: {provider_name}")
        
        return provider_info["class"], params
    
    @staticmethod
    def get_supported_providers() -> list[str]:
        """Get list of supported provider names."""
        return list(ProviderUtils.PROVIDER_MAP.keys())
    
    @staticmethod
    def is_provider_supported(provider_name: str) -> bool:
        """Check if a provider is supported."""
        return provider_name in ProviderUtils.PROVIDER_MAP