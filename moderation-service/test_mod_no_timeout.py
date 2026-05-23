import requests
t = "Hello world!"
print("Testing...")
r = requests.post("http://localhost:8000/moderate", json={"text": t})
print(r.status_code, r.json())
