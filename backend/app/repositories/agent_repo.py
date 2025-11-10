import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

class AgentRepository:
    """Repository for managing agent/model configurations."""
    
    _MODELS_PATH: Path = "./app/agent/models.json"

    def _load_models(self) -> Dict[str, Any]:
        """Load all models from models.json."""
        try:
            with open(self._MODELS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"models.json not found at {self._MODELS_PATH}. Creating new file.")
            return {}
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in models.json: {e}")
            raise

    def _save_models(self, models: Dict[str, Any]) -> None:
        """Save models to models.json."""
        try:
            with open(self._MODELS_PATH, "w", encoding="utf-8") as f:
                json.dump(models, f, indent=2, ensure_ascii=False)
            logger.info(f"Models saved to {self._MODELS_PATH}")
        except Exception as e:
            logger.error(f"Failed to save models: {e}")
            raise

    def _has_model(self, model_id: str) -> bool:
        """Check if model exists."""
        models = self._load_models()
        return model_id in models

    def load_agent(self, model_id: str) -> Dict[str, Any]:
        """
        Load agent configuration from models.json by model_id.
        
        Args:
            model_id: Model identifier
            
        Returns:
            Model configuration dictionary
            
        Raises:
            ValueError: If model not found
        """
        try:
            models = self._load_models()
            
            if model_id not in models:
                raise ValueError(
                    f"Model ID '{model_id}' not found in models.json. "
                    f"Available models: {list(models.keys())}"
                )
            
            agent_config = models[model_id]
            logger.info(f"Loaded configuration for model: {model_id}")
            return agent_config
            
        except Exception as e:
            logger.error(f"Failed to load agent configuration: {e}")
            raise

    def list_models(self) -> List[str]:
        """
        List all available model IDs.
        
        Returns:
            List of model IDs
        """
        try:
            models = self._load_models()
            return list(models.keys())
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            return []

    def get_models_by_provider(self, provider: str) -> List[str]:
        """
        Get all models for a specific provider.
        
        Args:
            provider: Provider name (gemini, openai, anthropic, huggingface)
            
        Returns:
            List of model IDs for the provider
        """
        try:
            models = self._load_models()
            return [
                model_id for model_id, config in models.items()
                if config.get("provider") == provider
            ]
        except Exception as e:
            logger.error(f"Failed to get models by provider: {e}")
            return []

    def add_model(
        self, 
        model_id: str, 
        provider: str, 
        system_prompt: bool = True,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **extra_config
    ) -> None:
        """
        Add a new model configuration to models.json.
        
        Args:
            model_id: Unique model identifier
            provider: Provider name (gemini, openai, anthropic, huggingface)
            system_prompt: Whether model supports system prompts
            temperature: Optional temperature setting
            max_tokens: Optional max tokens setting
            **extra_config: Additional configuration parameters
            
        Raises:
            ValueError: If model already exists or provider invalid
        """
        try:
            models = self._load_models()
            
            # Validate model doesn't exist
            if model_id in models:
                raise ValueError(f"Model ID '{model_id}' already exists.")
            
            # Validate provider
            valid_providers = ["gemini", "openai", "anthropic", "huggingface"]
            if provider not in valid_providers:
                raise ValueError(
                    f"Invalid provider '{provider}'. "
                    f"Must be one of: {valid_providers}"
                )
            
            # Build configuration
            config = {
                "provider": provider,
                "system_prompt": system_prompt
            }
            
            # Add optional parameters
            if temperature is not None:
                config["temperature"] = temperature
            if max_tokens is not None:
                config["max_tokens"] = max_tokens
            
            # Add extra config
            config.update(extra_config)
            
            # Add to models
            models[model_id] = config
            
            # Save
            self._save_models(models)
            
            logger.info(f"Model '{model_id}' added successfully with provider '{provider}'")
            
        except Exception as e:
            logger.error(f"Failed to add model: {e}")
            raise

    def update_model(
        self,
        model_id: str,
        provider: Optional[str] = None,
        system_prompt: Optional[bool] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **extra_config
    ) -> None:
        """
        Update an existing model configuration.
        
        Args:
            model_id: Model identifier to update
            provider: Optional new provider name
            system_prompt: Optional system prompt support flag
            temperature: Optional temperature setting
            max_tokens: Optional max tokens setting
            **extra_config: Additional configuration to update
            
        Raises:
            ValueError: If model doesn't exist
        """
        try:
            models = self._load_models()
            
            if model_id not in models:
                raise ValueError(f"Model ID '{model_id}' not found.")
            
            # Update fields if provided
            if provider is not None:
                models[model_id]["provider"] = provider
            if system_prompt is not None:
                models[model_id]["system_prompt"] = system_prompt
            if temperature is not None:
                models[model_id]["temperature"] = temperature
            if max_tokens is not None:
                models[model_id]["max_tokens"] = max_tokens
            
            # Update extra config
            models[model_id].update(extra_config)
            
            # Save
            self._save_models(models)
            
            logger.info(f"Model '{model_id}' updated successfully")
            
        except Exception as e:
            logger.error(f"Failed to update model: {e}")
            raise

    def delete_model(self, model_id: str) -> None:
        """
        Delete a model configuration.
        
        Args:
            model_id: Model identifier to delete
            
        Raises:
            ValueError: If model doesn't exist
        """
        try:
            models = self._load_models()
            
            if model_id not in models:
                raise ValueError(f"Model ID '{model_id}' not found.")
            
            del models[model_id]
            
            # Save
            self._save_models(models)
            
            logger.info(f"Model '{model_id}' deleted successfully")
            
        except Exception as e:
            logger.error(f"Failed to delete model: {e}")
            raise

    def get_model_info(self, model_id: str) -> Dict[str, Any]:
        """
        Get complete information about a model.
        
        Args:
            model_id: Model identifier
            
        Returns:
            Model configuration with metadata
        """
        config = self.load_agent(model_id)
        return {
            "model_id": model_id,
            **config
        }

