import os, sys, requests, base64

env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
api_key = ""
with open(env_path) as f:
    for line in f:
        if line.startswith("GEMINI_KEY="):
            api_key = line.split("=", 1)[1].strip()

print(f"Key: {api_key[:12]}...{api_key[-4:]}")
print()

# Try all text+image models that ARE listed as available for this key
models_to_try = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-001",
    "gemini-2.5-flash-lite",
]

for model in models_to_try:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": "Generate a photorealistic modern living room interior design image. Show furniture, lighting, and decor."}]}],
        "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]}
    }
    print(f"Testing {model}...")
    try:
        resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=45)
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            got_image = False
            for c in data.get("candidates", []):
                for part in c.get("content", {}).get("parts", []):
                    if "inlineData" in part:
                        b64 = part["inlineData"]["data"]
                        img = base64.b64decode(b64)
                        with open(f"test_output_{model.replace('-','_')}.jpg", "wb") as f:
                            f.write(img)
                        print(f"  SUCCESS! Image saved ({len(img)} bytes)")
                        got_image = True
                    elif "text" in part:
                        print(f"  Text only (no image): {part['text'][:80]}")
            if not got_image:
                print(f"  No image in response")
        else:
            err = resp.json().get("error", {})
            print(f"  Error: {err.get('code')} - {err.get('message','')[:150]}")
    except Exception as e:
        print(f"  Exception: {e}")
    print()
