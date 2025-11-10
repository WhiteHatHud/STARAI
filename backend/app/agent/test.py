from app.agent.base_agent import BaseAgent

print("Testing BaseAgent...")

# Test Gemini
try:
    print("\n1. Testing Gemini...")
    agent = BaseAgent("gemini-2.5-flash")
    response = agent.run("What is SQL injection?")
    print(f"✓ Gemini Response: {response[:100]}...")
except Exception as e:
    print(f"✗ Gemini Error: {e}")
    
print("\n✅ Testing complete!")