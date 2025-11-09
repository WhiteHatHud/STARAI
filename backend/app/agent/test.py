from app.agent.base_agent import BaseAgent

agent = BaseAgent("segolilylabs/Lily-Cybersecurity-7B-v0.2")
response = agent.run("How to deal with DDOS attacks?")

print(response)