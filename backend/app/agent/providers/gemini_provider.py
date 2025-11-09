from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from .langchain_provider import LangChainProvider
import logging

logger = logging.getLogger(__name__)


class GeminiProvider(LangChainProvider):
    """Gemini provider via LangChain."""
    
    def _initialize_client(self) -> ChatGoogleGenerativeAI:
        api_key = self.env_config.get("GEMINI_API_KEY")
        
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment configuration")
        
        client = ChatGoogleGenerativeAI(
            model=self.model,
            google_api_key=api_key,
            temperature=0.7,
            max_output_tokens= None,
        )
        
        logger.info(f"Initialized ChatGoogleGenerativeAI for model: {self.model}")
        return client