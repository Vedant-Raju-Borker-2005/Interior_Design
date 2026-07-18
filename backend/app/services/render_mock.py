import os
import base64
import datetime
import requests

UNSPLASH = "https://images.unsplash.com"

# Room-type specific fallback images organised by style
ROOM_RENDER_IMAGES: dict[str, dict[str, list[str]]] = {
    "living_room": {
        "modern":              [f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=1200&h=800&fit=crop&q=85",
                                f"{UNSPLASH}/photo-1586023492125-27b2c045efd7?w=1200&h=800&fit=crop&q=85",
                                f"{UNSPLASH}/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop&q=85"],
        "scandinavian":        [f"{UNSPLASH}/photo-1616137466211-f939a420be84?w=1200&h=800&fit=crop&q=85",
                                f"{UNSPLASH}/photo-1600566753190-17f0baa2a6c3?w=1200&h=800&fit=crop&q=85"],
        "indian_contemporary": [f"{UNSPLASH}/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop&q=85",
                                f"{UNSPLASH}/photo-1613977257363-707ba9348227?w=1200&h=800&fit=crop&q=85"],
        "luxury":              [f"{UNSPLASH}/photo-1617806118233-18e1de247200?w=1200&h=800&fit=crop&q=85",
                                f"{UNSPLASH}/photo-1618220179428-22790b461013?w=1200&h=800&fit=crop&q=85"],
    },
    "bedroom_master": {
        "modern":   [f"{UNSPLASH}/photo-1616594039964-ae9021a400a0?w=1200&h=800&fit=crop&q=85",
                     f"{UNSPLASH}/photo-1505693416388-ac5ce068fe85?w=1200&h=800&fit=crop&q=85"],
        "luxury":   [f"{UNSPLASH}/photo-1522771739844-6a9f6d5f14af?w=1200&h=800&fit=crop&q=85",
                     f"{UNSPLASH}/photo-1540518614846-7eded433c457?w=1200&h=800&fit=crop&q=85"],
        "scandinavian": [f"{UNSPLASH}/photo-1505693416388-ac5ce068fe85?w=1200&h=800&fit=crop&q=85"],
    },
    "bedroom_2": {
        "modern":   [f"{UNSPLASH}/photo-1522771739844-6a9f6d5f14af?w=1200&h=800&fit=crop&q=85"],
        "kids":     [f"{UNSPLASH}/photo-1522771739844-6a9f6d5f14af?w=1200&h=800&fit=crop&q=85"],
    },
    "kitchen": {
        "modern":   [f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=1200&h=800&fit=crop&q=85",
                     f"{UNSPLASH}/photo-1556911220-bff31c812dba?w=1200&h=800&fit=crop&q=85",
                     f"{UNSPLASH}/photo-1600489000022-c2086d79f9d4?w=1200&h=800&fit=crop&q=85"],
        "luxury":   [f"{UNSPLASH}/photo-1600585152220-90363fe7e115?w=1200&h=800&fit=crop&q=85"],
    },
    "bathroom": {
        "modern":   [f"{UNSPLASH}/photo-1552321554-5fefe8c9ef14?w=1200&h=800&fit=crop&q=85",
                     f"{UNSPLASH}/photo-1584622650111-993a426fbf0a?w=1200&h=800&fit=crop&q=85"],
        "luxury":   [f"{UNSPLASH}/photo-1507652313519-d4e9174996dd?w=1200&h=800&fit=crop&q=85"],
    },
    "balcony": {
        "modern":   [f"{UNSPLASH}/photo-1595526114035-0d45ed16cfbf?w=1200&h=800&fit=crop&q=85"],
    },
}

STYLE_PROMPTS = {
    "modern":               "modern minimalist interior, clean lines, neutral tones, open space, professional architectural photography",
    "scandinavian":         "scandinavian hygge style, light wood, white walls, cozy textures, natural diffused light",
    "indian_contemporary":  "Indian contemporary interior, warm earthy tones, brass accents, rich textiles, terracotta palette",
    "luxury":               "ultra-luxury interior, marble surfaces, velvet upholstery, bespoke furniture, dramatic architectural lighting",
    "mediterranean":        "mediterranean interior, arched doorways, terracotta tiles, sea-inspired blue and white palette",
    "boho":                 "boho chic interior, rattan furniture, macrame, indoor plants, layered rugs, warm amber lighting",
    "industrial":           "industrial loft interior, exposed brick, steel beams, leather accents, dark moody palette",
}


def get_render_images(style: str, room_type: str) -> list[str]:
    room_images = ROOM_RENDER_IMAGES.get(room_type, {})
    return (
        room_images.get(style)
        or room_images.get("modern")
        or ROOM_RENDER_IMAGES.get("living_room", {}).get("modern", [])
        or [f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=1200&h=800&fit=crop&q=85"]
    )


def get_gemini_render_with_image(prompt: str, image_b64: str, mime_type: str = "image/jpeg") -> str | None:
    """
    Send room photo + style/product prompt to Gemini 2.0 Flash.
    Gemini sees the actual room and redesigns it according to the prompt.
    Returns a local file URL or None on failure.
    """
    api_key = os.getenv("GEMINI_KEY")
    if not api_key:
        print("[Render] GEMINI_KEY not set — using fallback images")
        return None

    os.makedirs(os.path.join("pdfs", "renders"), exist_ok=True)

    # Combined redesign instruction
    redesign_instruction = (
        f"You are an expert interior designer. "
        f"This is a photo of an actual room. "
        f"Redesign this exact room keeping the same wall positions, windows, and floor area. "
        f"Apply the following style and products: {prompt} "
        f"The room layout and proportions must remain identical — only change the style, furniture, finishes and decor. "
        f"Output a photorealistic render that looks like a professional architectural photography shot of the redesigned room."
    )

    flash_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash-preview-image-generation:generateContent?key={api_key}"
    )
    flash_payload = {
        "contents": [{
            "parts": [
                {"inlineData": {"mimeType": mime_type, "data": image_b64}},
                {"text": redesign_instruction}
            ]
        }],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
    }
    try:
        print(f"[Render] Img2Img via Gemini Flash — prompt: {redesign_instruction[:80]}…")
        resp = requests.post(flash_url, json=flash_payload,
                             headers={"Content-Type": "application/json"}, timeout=90)
        if resp.status_code == 200:
            data = resp.json()
            for candidate in data.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    if "inlineData" in part:
                        img_bytes = base64.b64decode(part["inlineData"]["data"])
                        filename = f"gen_{int(datetime.datetime.utcnow().timestamp())}_img2img.jpg"
                        filepath = os.path.join("pdfs", "renders", filename)
                        with open(filepath, "wb") as f:
                            f.write(img_bytes)
                        print(f"[Render] Img2Img render saved: {filename}")
                        return f"/static/pdfs/renders/{filename}"
        else:
            print(f"[Render] Gemini img2img error {resp.status_code}: {resp.text[:300]}")
    except Exception as e:
        print(f"[Render] Gemini img2img exception: {e}")

    # Fall through to text-only render
    return get_gemini_render(prompt)


def build_prompt(style: str, color_palette: list, room_type: str = "living_room",
                 products: list = None, layout_prompt: str = "") -> str:
    """Build a detailed, product-aware rendering prompt."""
    style_desc = STYLE_PROMPTS.get(style, style)
    room_label = room_type.replace("_", " ")

    # Build product descriptions
    product_parts = []
    if products:
        for p in products:
            name = p.get("name", "")
            color = p.get("color") or p.get("custom_color", "")
            fabric = p.get("fabric") or p.get("custom_fabric", "")
            size = p.get("size") or p.get("custom_size", "")
            texture = p.get("texture") or p.get("custom_texture", "")

            desc = name
            attrs = [a for a in [color, fabric, size, texture] if a]
            if attrs:
                desc += f" ({', '.join(attrs)})"
            product_parts.append(desc)

    product_sentence = ""
    if product_parts:
        product_sentence = f"The room contains: {'; '.join(product_parts)}. "

    placement_sentence = layout_prompt.strip() if layout_prompt else ""

    return (
        f"photorealistic interior design render of a {room_label}, {style_desc}. "
        f"{product_sentence}"
        f"{placement_sentence} "
        f"Professional interior photography, natural daylight, 8K resolution, architectural digest quality, "
        f"high detail, no people, no text."
    )


def get_gemini_render(prompt: str) -> str | None:
    """
    Try Gemini 2.0 Flash image generation (primary), then Imagen 3 (secondary).
    Returns a local file URL or None on failure.
    """
    api_key = os.getenv("GEMINI_KEY")
    if not api_key:
        print("[Render] GEMINI_KEY not set — using fallback images")
        return None

    os.makedirs(os.path.join("pdfs", "renders"), exist_ok=True)

    # ── Primary: Gemini 2.0 Flash image generation ──────────────────────────
    flash_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash-preview-image-generation:generateContent?key={api_key}"
    )
    flash_payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"]}
    }
    try:
        print(f"[Render] Trying Gemini Flash image gen: {prompt[:80]}…")
        resp = requests.post(flash_url, json=flash_payload,
                             headers={"Content-Type": "application/json"}, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            for candidate in data.get("candidates", []):
                for part in candidate.get("content", {}).get("parts", []):
                    if "inlineData" in part:
                        img_bytes = base64.b64decode(part["inlineData"]["data"])
                        filename = f"gen_{int(datetime.datetime.utcnow().timestamp())}_flash.jpg"
                        filepath = os.path.join("pdfs", "renders", filename)
                        with open(filepath, "wb") as f:
                            f.write(img_bytes)
                        print(f"[Render] Gemini Flash render saved: {filename}")
                        return f"/static/pdfs/renders/{filename}"
        else:
            print(f"[Render] Gemini Flash error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[Render] Gemini Flash exception: {e}")

    # ── Secondary: Imagen 3 ──────────────────────────────────────────────────
    imagen_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"imagen-3.0-generate-002:predict?key={api_key}"
    )
    imagen_payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "personGeneration": "DONT_ALLOW",
            "aspectRatio": "3:2"
        }
    }
    try:
        print(f"[Render] Trying Imagen 3: {prompt[:80]}…")
        resp = requests.post(imagen_url, json=imagen_payload,
                             headers={"Content-Type": "application/json"}, timeout=45)
        if resp.status_code == 200:
            predictions = resp.json().get("predictions", [])
            if predictions:
                img_bytes = base64.b64decode(predictions[0].get("bytesBase64Encoded", ""))
                filename = f"gen_{int(datetime.datetime.utcnow().timestamp())}_imagen.jpg"
                filepath = os.path.join("pdfs", "renders", filename)
                with open(filepath, "wb") as f:
                    f.write(img_bytes)
                print(f"[Render] Imagen 3 render saved: {filename}")
                return f"/static/pdfs/renders/{filename}"
        else:
            print(f"[Render] Imagen 3 error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[Render] Imagen 3 exception: {e}")

    return None
