"""Test imports to verify circular dependency is fixed."""

print("Testing imports...")

try:
    from app.repositories import AgentRepository, ProviderRepository
    print("✓ Successfully imported repositories")
    
    from app.agent.base_agent import BaseAgent
    print("✓ Successfully imported BaseAgent")
    
    from app.agent.providers import BaseProvider, LangChainProvider, HuggingFaceProvider
    print("✓ Successfully imported providers")
    
    # Test instantiation
    repo = ProviderRepository()
    print(f"✓ Supported providers: {repo.get_provider_list()}")
    
    # Test agent
    agent = BaseAgent("gemini-2.5-flash")
    print("✓ BaseAgent instantiated successfully")
    
    print("\n✅ All imports successful!")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    import traceback
    traceback.print_exc()