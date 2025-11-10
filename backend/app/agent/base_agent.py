from typing import Any, Optional
from app.repositories.agent_repo import AgentRepository
from app.repositories.provider_repo import ProviderRepository
import logging

logger = logging.getLogger(__name__)


class BaseAgent:
    def __init__(self, model_id: str = "gpt-5-mini"):
        
        self.agent = AgentRepository()
        self.provider = ProviderRepository()
        self.model_id = model_id
        self._provider_instance = None
        self.system_prompt = self._load_system_prompt()

    def _load_system_prompt(self) -> str:
        """Load system prompt from prompt.yaml."""
        try:
            import yaml
            from pathlib import Path
            
            prompt_file = Path(__file__).parent / "prompt.yaml"
            with open(prompt_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                return data.get("system_prompt", "You are a helpful AI assistant.")
        except Exception as e:
            logger.warning(f"Could not load system prompt: {e}")
            return "You are a helpful AI assistant."

    def _get_provider(self) -> Any:
        if self._provider_instance is None:
            agent_config = self.agent.load_agent(self.model_id)
            provider_name = agent_config.get("provider")

            if not provider_name:
                raise ValueError(f"No provider specified for model '{self.model_id}'")
            
            provider_class = self.provider.get_provider_class(provider_name)
            if not provider_class:
                raise ValueError(f"Provider '{provider_name}' not found.")
            
            # Pass system_prompt to provider
            self._provider_instance = provider_class(
                model_id=self.model_id,
                config=agent_config,
                system_prompt=self.system_prompt
            )
            
            logger.info(f"Initialized {provider_name} provider for model '{self.model_id}'")
        
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