from app.agent.base_agent import BaseAgent

agent = BaseAgent("gemini-2.5-flash")
response = agent.run("How to deal with DDOS attacks?")

print(response)