from typing import Optional, Any, Dict
from langchain_core.prompts import ChatPromptTemplate
from app.utils.config import load_config
from app.utils.provider_utils import ProviderUtils
from .base_provider import BaseProvider
import logging

logger = logging.getLogger(__name__)


class LangChainProvider(BaseProvider):
    """LangChain-based provider supporting multiple LLM APIs."""
    
    def __init__(
        self, 
        model_id: str, 
        config: Dict[str, Any], 
        system_prompt: str = "You are a helpful AI assistant."
    ):
        """
        Initialize LangChain provider.
        
        Args:
            model_id: Model identifier
            config: Configuration from models.json
            system_prompt: System prompt from prompt.yaml
        """
        super().__init__(model_id, config, system_prompt)
        
        self.env_config = load_config()
        self.provider_name = config.get("provider")
        
        if not self.provider_name:
            raise ValueError(f"No provider specified in config for model {model_id}")
        
        # Initialize provider utils and client
        self.provider_utils = ProviderUtils(self.env_config)
        self.client = self._initialize_client()
        self._setup_prompt()
        
        logger.info(f"Initialized {self.provider_name} provider for model: {model_id}")

    def _initialize_client(self) -> Any:
        """Initialize the appropriate LangChain chat model using factory pattern."""
        return self.provider_utils.get_provider_instance(
            provider_name=self.provider_name,
            model_id=self.model_id,
            config=self.config
        )

    def _setup_prompt(self) -> None:
        """Setup prompt template based on system_prompt configuration."""
        if self.has_system_prompt:
            self.prompt = ChatPromptTemplate.from_messages([
                ("system", "{system_prompt}"),
                ("human", "{input}")
            ])
        else:
            self.prompt = ChatPromptTemplate.from_messages([
                ("human", "{input}")
            ])

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
            
            if self.has_system_prompt:
                system_msg = system or self.system_prompt
                result = chain.invoke({
                    "system_prompt": system_msg,
                    "input": prompt
                })
            else:
                result = chain.invoke({"input": prompt})
            
            return getattr(result, "content", str(result))
            
        except Exception as e:
            logger.error(f"Error running LangChain client: {e}")
            raise RuntimeError(f"Generation failed: {e}") from e