import logging
from typing import Dict, Any, Optional
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import yaml
from app.utils.read_prompt import ReadPrompt

logger = logging.getLogger(__name__)


class HuggingFaceProvider:
    """HuggingFace transformers provider."""
    
    def __init__(self, model: str, config: Dict[str, Any], system_prompt: str = "You are a helpful AI assistant."):
        """
        Initialize HuggingFace provider.
        
        Args:
            model_id: Model identifier
            config: Configuration from models.json
            system_prompt: System prompt from prompt.yaml
        """
        self.model= self._load_model(model)
        self.config = config
        self.system_prompt = ReadPrompt.get_system_prompt() or system_prompt
        self.device = self._resolve_device("auto")
        logger.info(f"Loading HuggingFace model: {model} on {self.device}")
        
        self.tokenizer = AutoTokenizer.from_pretrained(model)
        self.has_system_prompt = self.config.get("system_prompt", False)
        
        logger.info(f"Initialized HuggingFace provider for model: {model}")

    def _load_model(self, model_name):
        # bnb_config = BitsAndBytesConfig(
        #     load_in_4bit=True,
        #     bnb_4bit_compute_dtype=torch.bfloat16,
        #     bnb_4bit_use_double_quant=True,
        #     bnb_4bit_quant_type="nf4",
        # )

        model = AutoModelForCausalLM.from_pretrained(
                model_name,
                device_map="auto",
                # quantization_config=bnb_config,
                trust_remote_code=True,
                dtype=torch.bfloat16,
            )
        
        return model.to(self.device)
    
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
            "max_new_tokens": kwargs.get("max_new_tokens", 1024),
            "temperature": kwargs.get("temperature", None),
            "repetition_penalty": kwargs.get("repetition_penalty", 1.2),
            "do_sample": kwargs.get("do_sample", False),
            "use_cache": True,
            "eos_token_id": self.tokenizer.eos_token_id,
            "pad_token_id": self.tokenizer.pad_token_id,
        }

        with torch.inference_mode():
            output = self.model.generate(**inputs, **generation_args)

        response = self.tokenizer.decode(
            output[0][inputs["input_ids"].shape[1]:], 
            skip_special_tokens=True
        )

        return response