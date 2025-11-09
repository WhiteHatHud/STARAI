from typing import Any, Optional
import logging
from app.repositories import AgentRepository, ProviderRepository
import yaml

logger = logging.getLogger(__name__)


class BaseAgent:
    def __init__(self, model: str = "gemini-2.5-flash"):
        self.agent = AgentRepository()
        self.provider = ProviderRepository()
        self.model = model
        self._provider_instance = None

    def _get_provider(self) -> Any:
        if self._provider_instance is None:
            agent_config = self.agent.load_agent(self.model)
            provider_name = agent_config.get("provider")

            if not provider_name:
                raise ValueError(f"No provider specified for model '{self.model}'")
            
            provider_class = self.provider.get_provider_class(provider_name)
            if not provider_class:
                raise ValueError(f"Provider '{provider_name}' not found.")
            
            self._provider_instance = provider_class(
                model=self.model,
                config=agent_config
            )
            
        logger.info(f"Initialized {provider_name} provider for model '{self.model}'")
        return self._provider_instance

    def run(self, prompt: str, **kwargs) -> str:
        """
        Run the model with a prompt.
        
        Args:
            prompt: User input
            **kwargs: Optional generation parameters (system, temperature, etc.)
            
        Returns:
            Model response
        """
        provider = self._get_provider()
        response = provider.generate(prompt, **kwargs)
        return response