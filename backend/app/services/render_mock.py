import os
import base64
import datetime
import httpx

UNSPLASH = "https://images.unsplash.com"

RENDER_IMAGES: dict[str, list[str]] = {
    "modern": [
        f"{UNSPLASH}/photo-1586023492125-27b2c045efd7?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1618220179428-22790b461013?w=1200&h=800&fit=crop&q=85",
    ],
    "scandinavian": [
        f"{UNSPLASH}/photo-1616137466211-f939a420be84?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1600566753190-17f0baa2a6c3?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1540518614846-7eded433c457?w=1200&h=800&fit=crop&q=85",
    ],
    "indian_contemporary": [
        f"{UNSPLASH}/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1616594039964-ae9021a400a0?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1598928506311-c55ded91a20c?w=1200&h=800&fit=crop&q=85",
    ],
    "luxury": [
        f"{UNSPLASH}/photo-1613977257363-707ba9348227?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1617806118233-18e1de247200?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1618220179428-22790b461013?w=1200&h=800&fit=crop&q=85",
    ],
    "mediterranean": [
        f"{UNSPLASH}/photo-1600607686527-6fb886090705?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1560185007-c5ca9d2c014d?w=1200&h=800&fit=crop&q=85",
    ],
    "boho": [
        f"{UNSPLASH}/photo-1616046229478-9901c5536a45?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1598928506311-c55ded91a20c?w=1200&h=800&fit=crop&q=85",
    ],
    "industrial": [
        f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
        f"{UNSPLASH}/photo-1600210492486-724fe5c67fb3?w=1200&h=800&fit=crop&q=85",
    ],
}

ROOM_RENDER_IMAGES: dict[str, dict[str, list[str]]] = {
    "kitchen": {
        "modern": [
            f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1556911220-bff31c812dba?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1600489000022-c2086d79f9d4?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1600585152220-90363fe7e115?w=1200&h=800&fit=crop&q=85",
        ],
        "scandinavian": [
            f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1600489000022-c2086d79f9d4?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1556912173-3bb406ef7e77?w=1200&h=800&fit=crop&q=85",
        ],
        "indian_contemporary": [
            f"{UNSPLASH}/photo-1556911220-bff31c812dba?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1600585152220-90363fe7e115?w=1200&h=800&fit=crop&q=85",
        ],
        "luxury": [
            f"{UNSPLASH}/photo-1600585152220-90363fe7e115?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1556911220-bff31c812dba?w=1200&h=800&fit=crop&q=85",
        ],
        "mediterranean": [
            f"{UNSPLASH}/photo-1556912173-3bb406ef7e77?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
        ],
        "boho": [
            f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1556911220-bff31c812dba?w=1200&h=800&fit=crop&q=85",
        ],
    },
    "bathroom": {
        "modern": [
            f"{UNSPLASH}/photo-1552321554-5fefe8c9ef14?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1584622650111-993a426fbf0a?w=1200&h=800&fit=crop&q=85",
        ],
    },
    "balcony": {
        "modern": [
            f"{UNSPLASH}/photo-1595526114035-0d45ed16cfbf?w=1200&h=800&fit=crop&q=85",
            f"{UNSPLASH}/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop&q=85",
        ],
    },
}

STYLE_PROMPTS = {
    "modern":               "modern minimalist, clean lines, neutral tones, open space",
    "scandinavian":         "scandinavian hygge, light wood, white walls, cozy textures, natural light",
    "indian_contemporary":  "indian contemporary, warm tones, brass accents, rich textiles, earthy palette",
    "luxury":               "ultra-luxury, marble, velvet, bespoke furniture, architectural lighting",
    "mediterranean":        "mediterranean, arched doorways, terracotta, sea-inspired palette",
    "boho":                 "boho chic, rattan, macrame, plants, layered rugs, warm amber",
    "industrial":           "industrial loft, exposed brick, steel beams, leather, dark palette",
}


def get_render_images(style: str, room_type: str) -> list[str]:
    room_images = ROOM_RENDER_IMAGES.get(room_type, {})
    return (
        room_images.get(style)
        or room_images.get("modern")
        or RENDER_IMAGES.get(style)
        or RENDER_IMAGES["modern"]
    )


def build_prompt(style: str, color_palette: list, room_type: str = "living room") -> str:
    style_desc = STYLE_PROMPTS.get(style, style)
    room_label = room_type.replace("_", " ")
    colors = ", ".join(color_palette) if color_palette else "neutral palette"
    return (
        f"photorealistic interior of a {room_label}, {style_desc}, "
        f"color palette: {colors}, natural daylight, 8k resolution, architectural digest style, "
        f"professional interior photography"
    )


def get_gemini_render(prompt: str) -> str:
    api_key = os.getenv("GEMINI_KEY")
    if not api_key:
        print("Gemini rendering skipped: GEMINI_KEY not found in environment")
        return None

    # Google AI Studio Imagen 3 endpoint
    url = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key={api_key}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "prompt": prompt,
        "numberOfImages": 1,
        "outputMimeType": "image/jpeg",
        "aspectRatio": "3:2"
    }

    try:
        print(f"Requesting Gemini Imagen rendering: {prompt[:60]}...")
        response = httpx.post(url, headers=headers, json=payload, timeout=25.0)
        if response.status_code == 200:
            data = response.json()
            images = data.get("generatedImages", [])
            if images:
                img_bytes = base64.b64decode(images[0]["image"]["imageBytes"])
                
                os.makedirs(os.path.join("pdfs", "renders"), exist_ok=True)
                filename = f"gen_{int(datetime.datetime.utcnow().timestamp())}.jpg"
                filepath = os.path.join("pdfs", "renders", filename)
                with open(filepath, "wb") as f:
                    f.write(img_bytes)
                
                print(f"Gemini render completed and saved: /static/pdfs/renders/{filename}")
                return f"/static/pdfs/renders/{filename}"
            else:
                print(f"Gemini Imagen returned empty image list: {response.text}")
        else:
            print(f"Gemini Imagen API error: status {response.status_code}, details: {response.text}")
    except Exception as e:
        print(f"Failed to fetch render from Gemini Imagen API: {e}")
        
    return None
