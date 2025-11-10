import yaml
import logging

logger = logging.getLogger(__name__)

class ReadPrompt:
    
    @staticmethod
    def get_system_prompt() -> None:
        try:
            with open("app/agent/prompt.yaml", "r") as f:
                data = yaml.safe_load(f)
                return data.get("system_prompt")
        except Exception as e:
            logger.error(f"Error getting system prompt: {e}")