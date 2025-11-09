from app.agent.providers import GeminiProvider, HuggingFaceProvider

class ProviderRepository:
    read_provider = {
        "huggingface": HuggingFaceProvider,
        "gemini": GeminiProvider,
    }
    
    def get_provider_class(self, provider_name):
        return self.read_provider.get(provider_name)
    
    def get_provider_list(self) -> list[str]:
        return list(self.read_provider.keys())