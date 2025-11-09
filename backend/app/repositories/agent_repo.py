import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class AgentRepository:
    _MODELS_PATH: Path = Path(__file__).resolve().parent.parent / "agent" / "models.json"

    def _has_model(self, model_id: str) -> bool:
        """Check if model exists."""
        models = self.list_models()
        return model_id in models

    def load_agent(self, model_id: str) -> Dict[str, Any]:
        """Load agent configuration from models.json by model_id."""
        try:
            with open(self._MODELS_PATH, "r", encoding="utf-8") as f:
                models = json.load(f)
            if self._has_model(model_id):
                agent_config = models.get(model_id)
            else:
                raise ValueError(f"Model ID '{model_id}' not found in models.json.")
            return agent_config
        except Exception as e:
            logger.error(f"Failed to load agent configuration: {e}")
            raise

    def list_models(self) -> List[str]:
        """List all available models."""
        try:
            with open(self._MODELS_PATH, "r", encoding="utf-8") as f:
                models = json.load(f)
                return list(models.keys())
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []

    def add_model(self, model_td:str, provider: str, system_prompt: bool) -> None:
        """Add a new model configuration to models.json."""
        try:
            with open(self._MODELS_PATH, "r", encoding="utf-8") as f:
                models = json.load(f)
            if model_td in models:
                raise ValueError(f"Model ID '{model_td}' already exists.")
            models[model_td] = {
                "provider": provider,
                "system_prompt": system_prompt
            }
            with open(self._MODELS_PATH, "w", encoding="utf-8") as f:
                json.dump(models, f, indent=4)
            logger.info(f"Model '{model_td}' added successfully.")
        except Exception as e:
            logger.error(f"Failed to add model: {e}")
            raise

