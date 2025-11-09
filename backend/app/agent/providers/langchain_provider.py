from abc import ABC, abstractmethod
from typing import Optional, Any, Dict
from langchain_core.prompts import ChatPromptTemplate
from app.utils.config import load_config
import logging
from app.utils.read_prompt import ReadPrompt

logger = logging.getLogger(__name__)


class LangChainProvider(ABC):
    def __init__(self, model: str, config: Dict[str, Any]):
        self.model = model
        self.config = config
        self.env_config = load_config()
        self.has_system = self.config.get("system_prompt", False)
        self.system_prompt = ReadPrompt.get_system_prompt()
        self.client = self._initialize_client()
        self._setup_prompt()
        
        logger.info(f"Initialized LangChain provider for model: {model}")

    @abstractmethod
    def _initialize_client(self) -> Any:
        """Return a LangChain chat model (LCEL-compatible)."""
        raise NotImplementedError

    def _setup_prompt(self) -> None:
        """Setup prompt template based on system_prompt configuration."""
        try:
            
            if self.has_system:
                self.prompt = ChatPromptTemplate.from_messages([
                    ("system", "{system_prompt}"),
                    ("human", "{input}")
                ])
            else:
                self.prompt = ChatPromptTemplate.from_messages([
                    ("human", "{input}")
                ])
        except Exception as e:
            logger.error(f"Error setting up prompt template: {e}")
            raise

    def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """
        Generate response using LangChain.
        
        Args:
            prompt: User input
            system: Optional system message override
            **kwargs: Additional parameters
            
        Returns:
            Generated text
        """
        try:
            chain = self.prompt | self.client
            
            # Check if model supports system prompts
            if self.has_system:
                system_msg = system or self.system_prompt
                result = chain.invoke({
                    "system_prompt": system_msg,
                    "input": prompt
                })
            else:
                # No system prompt support - just send user message
                result = chain.invoke({"input": prompt})
            
            # Extract content from AIMessage
            return getattr(result, "content", str(result))
            
        except Exception as e:
            logger.error(f"Error running LangChain client: {e}")
            raise RuntimeError(f"Generation failed: {e}") from e