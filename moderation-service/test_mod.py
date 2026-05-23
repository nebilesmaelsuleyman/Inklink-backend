import requests

texts = [
    "Hello world!",
    "አቶ በቀለ ወደ ቢሮው እንደገባ ፋይሉን በጠረጴዛው ላይ ወርውሮ በንቀት ተመለከተኝ።"
]

for t in texts:
    print(f"Testing: {t[:20]}...")
    try:
        r = requests.post("http://localhost:8000/moderate", json={"text": t}, timeout=5)
        print(r.status_code, r.json())
    except Exception as e:
        print("Error:", e)
