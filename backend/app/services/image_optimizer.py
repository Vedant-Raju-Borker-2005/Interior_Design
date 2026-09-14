"""Web-sized image encoding for anything customers will see.

Feedback 1.6 traced back to the catalog: product photos were stored as 6-10 MB
PNGs straight off the renderer, and pages listing a dozen products stalled or
timed out. Every customer-facing upload now goes through here and is stored as a
bounded WebP instead.
"""
from __future__ import annotations

import io
import os
from typing import Optional

from PIL import Image, UnidentifiedImageError

# Product cards render at up to ~800 CSS px; 1600 covers 2x displays.
MAX_SIDE = 1600
WEBP_QUALITY = 82


def optimise_to_webp(data: bytes, dest_dir: str, stem: str,
                     max_side: int = MAX_SIDE, quality: int = WEBP_QUALITY) -> Optional[str]:
    """Encode `data` as WebP at `dest_dir/stem.webp`; return the filename.

    Returns None when the bytes are not a decodable raster image (for example a
    PDF or an animated GIF), so the caller can fall back to storing the original.
    """
    try:
        with Image.open(io.BytesIO(data)) as im:
            if getattr(im, "is_animated", False):
                return None
            im.load()
            # An alpha channel that is fully opaque only costs bytes.
            if im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema() == (255, 255):
                im = im.convert("RGB")
            elif im.mode not in ("RGB", "RGBA"):
                im = im.convert("RGBA" if "A" in im.getbands() else "RGB")

            w, h = im.size
            scale = min(1.0, max_side / float(max(w, h)))
            if scale < 1.0:
                im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)

            os.makedirs(dest_dir, exist_ok=True)
            filename = f"{stem}.webp"
            im.save(os.path.join(dest_dir, filename), "WEBP", quality=quality, method=6)
            return filename
    except (UnidentifiedImageError, OSError, ValueError):
        return None
