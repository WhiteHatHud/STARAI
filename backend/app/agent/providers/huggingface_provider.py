import logging
from typing import Dict, Any, Optional
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from .base_provider import BaseProvider

logger = logging.getLogger(__name__)


class HuggingFaceProvider(BaseProvider):
    """HuggingFace transformers provider."""
    
    def __init__(self, model_id: str, config: Dict[str, Any], system_prompt: str = "You are a helpful AI assistant."):
        """
        Initialize HuggingFace provider.
        
        Args:
            model_id: Model identifier
            config: Configuration from models.json
            system_prompt: System prompt from prompt.yaml
        """
        super().__init__(model_id, config, system_prompt)
        
        self.device = self._resolve_device("auto")
        
        logger.info(f"Loading HuggingFace model: {model_id} on {self.device}")
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_id)
        self.hf_model = AutoModelForCausalLM.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            device_map="auto" if self.device == "cuda" else None
        )
        
        if self.device != "cuda":
            self.hf_model = self.hf_model.to(self.device)
        
        logger.info(f"Initialized HuggingFace provider for model: {model_id}")
    
    def _resolve_device(self, device: str) -> str:
        """Resolve device string to actual device."""
        if device == "auto":
            if torch.cuda.is_available():
                return "cuda"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                return "mps"
            return "cpu"
        return device
    
    def generate(self, prompt: str, system: Optional[str] = None, **kwargs) -> str:
        """
        Generate response from HuggingFace model.
        
        Args:
            prompt: User input
            system: Optional system message override
            **kwargs: Override generation parameters
            
        Returns:
            Generated text
        """
        if self.has_system_prompt:
            system_msg = system or self.system_prompt
            messages = [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ]
        else:
            messages = [{"role": "user", "content": prompt}]

        text = self.tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        inputs = self.tokenizer(text, return_tensors="pt").to(self.device)

        generation_args = {
            "max_new_tokens": kwargs.get("max_new_tokens", 512),
            "temperature": kwargs.get("temperature", 0.7),
            "repetition_penalty": kwargs.get("repetition_penalty", 1.1),
            "do_sample": kwargs.get("do_sample", True),
            "top_p": kwargs.get("top_p", 0.95),
            "use_cache": True,
        }
        
        generation_args = {k: v for k, v in generation_args.items() if v is not None}

        with torch.inference_mode():
            output = self.hf_model.generate(**inputs, **generation_args)

        response = self.tokenizer.decode(
            output[0][inputs["input_ids"].shape[1]:], 
            skip_special_tokens=True
        )

        return response