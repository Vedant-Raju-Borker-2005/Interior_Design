"""Procedural PBR texture bakery. Generates albedo & normal maps encoded as base64."""
from __future__ import annotations

import base64
import io
import json
import math
import random
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter


def _generate_wood_grain(size: int = 128) -> Image.Image:
    im = Image.new("L", (size, size), 220)
    d = ImageDraw.Draw(im)
    rng = random.Random(42)
    for _ in range(30):
        y = rng.randint(0, size)
        d.line([(0, y), (size, y + rng.randint(-3, 3))], fill=rng.randint(180, 240), width=rng.randint(1, 3))
    im = im.filter(ImageFilter.GaussianBlur(radius=1.2))
    return im.convert("RGB")


def _generate_fabric_weave(size: int = 128) -> Image.Image:
    im = Image.new("L", (size, size), 222)
    d = ImageDraw.Draw(im)
    for x in range(0, size, 4):
        d.line([(x, 0), (x, size)], fill=210, width=1)
    for y in range(0, size, 4):
        d.line([(0, y), (size, y)], fill=230, width=1)
    im = im.filter(ImageFilter.GaussianBlur(radius=0.5))
    return im.convert("RGB")


def _generate_marble(size: int = 128) -> Image.Image:
    im = Image.new("RGB", (size, size), (228, 226, 222))
    d = ImageDraw.Draw(im)
    rng = random.Random(99)
    for _ in range(8):
        points = [(rng.randint(0, size), rng.randint(0, size)) for _ in range(5)]
        points.sort(key=lambda p: p[0])
        for i in range(len(points) - 1):
            d.line([points[i], points[i+1]], fill=(190, 188, 185), width=2)
    im = im.filter(ImageFilter.GaussianBlur(radius=2.0))
    return im


def _generate_normal_map(size: int = 128) -> Image.Image:
    # Standard flat normal map in tangent space: (128, 128, 255)
    return Image.new("RGB", (size, size), (128, 128, 255))


def _to_base64(im: Image.Image) -> str:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _mean_intensity(im: Image.Image) -> float:
    gray = im.convert("L")
    stat = gray.getdata()
    return round(float(sum(stat)) / (len(stat) * 255.0), 3)


def build_atlas() -> dict[str, Any]:
    textures = {
        "wood_oak": _generate_wood_grain(128),
        "wood_walnut": _generate_wood_grain(128),
        "fabric_linen": _generate_fabric_weave(128),
        "fabric_velvet": _generate_fabric_weave(128),
        "marble_carrara": _generate_marble(128),
    }

    maps: dict[str, str] = {}
    means: dict[str, float] = {}

    for name, img in textures.items():
        albedo_key = f"{name}_map"
        normal_key = f"{name}_normal"
        maps[albedo_key] = _to_base64(img)
        means[albedo_key] = _mean_intensity(img)
        maps[normal_key] = _to_base64(_generate_normal_map(128))

    return {"maps": maps, "means": means}


def main(out_path: str | Path = "build/textures.json") -> Path:
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    atlas = build_atlas()
    p.write_text(json.dumps(atlas), encoding="utf-8")
    return p


if __name__ == "__main__":
    main()
