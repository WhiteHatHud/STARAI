from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class BaseProvider(ABC):
    """Abstract base class for all AI providers."""
    
    def __init__(self, model_id: str, config: Dict[str, Any], system_prompt: str = "You are a helpful AI assistant."):
        """
        Initialize base provider.
        
        Args:
            model_id: Model identifier
            config: Configuration from models.json
            system_prompt: System prompt from prompt.yaml
        """
        self.model_id = model_id
        self.config = config
        self.system_prompt = system_prompt
        self.has_system_prompt = config.get("system_prompt", False)
        
        logger.info(f"Initializing {self.__class__.__name__} for model: {model_id}")
    
    @abstractmethod
    def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """
        Generate response from the model.
        
        Args:
            prompt: User input
            system: Optional system message override
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text
        """
        raise NotImplementedError