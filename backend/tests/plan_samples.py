"""Synthetic floor-plan images for the plan-tracing tests.

``one_bhk_plan`` is modelled on a typical Indian 1 BHK brochure plan: thick
dark walls with door and window gaps, coloured floors, furniture outlines,
room captions, a dimension line and a big "1 BHK" title. The true room boxes
(as fractions of the image) come back with it.
"""
from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFont

PX_PER_M = 59.4          # the scale the plan below is drawn at
WIDTH, HEIGHT = 609, 640


def _font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:     # Pillow < 10.1
        return ImageFont.load_default()


def one_bhk_plan() -> tuple[Image.Image, list[tuple[str, list[float]]]]:
    im = Image.new("RGB", (WIDTH, HEIGHT), "white")
    d = ImageDraw.Draw(im)
    beige, tile = (250, 238, 200), (205, 205, 205)
    d.rectangle([80, 92, 295, 280], fill=beige)                 # bedroom
    d.rectangle([300, 225, 497, 537], fill=beige)               # living / dining
    d.rectangle([80, 285, 142, 388], fill=tile)                 # WC
    d.rectangle([147, 343, 232, 402], fill=tile)                # bath
    d.rectangle([150, 407, 295, 537], fill=beige)               # kitchen
    d.rectangle([147, 285, 295, 338], fill=beige)               # lobby
    d.rectangle([305, 128, 492, 212], fill=(185, 150, 120))     # balcony tiles

    wall, t = (70, 70, 70), 9

    def hw(x0, x1, y):
        d.rectangle([x0, y - t // 2, x1, y + t // 2], fill=wall)

    def vw(x, y0, y1):
        d.rectangle([x - t // 2, y0, x + t // 2, y1], fill=wall)

    hw(75, 120, 88); hw(262, 300, 88)                          # bedroom top, window gap
    vw(75, 88, 390); vw(297, 88, 190); vw(297, 250, 400)
    hw(75, 232, 283); hw(290, 300, 283)                        # bedroom door gap
    vw(145, 283, 318); vw(145, 372, 410)                       # WC door gap
    hw(75, 150, 390); hw(145, 180, 340); hw(222, 240, 340)     # bath door gap
    vw(236, 340, 405); hw(145, 300, 405)
    vw(150, 405, 440); vw(150, 500, 540)                       # kitchen window gap
    hw(145, 430, 540); hw(490, 505, 540)                       # entrance gap
    vw(300, 430, 540)
    vw(500, 218, 540)
    hw(300, 330, 220); hw(385, 505, 220)                       # balcony door gap
    vw(497, 120, 220)
    # Balcony railing and side drawn as thin double lines, as brochure plans
    # usually do — not as solid walls.
    for off in (0, 5):
        d.line([300, 124 + off, 497, 124 + off], fill=(90, 90, 90), width=1)
        d.line([300 + off, 124, 300 + off, 220], fill=(90, 90, 90), width=1)

    d.rectangle([110, 130, 220, 240], outline=(80, 80, 80), width=1)
    d.rectangle([390, 280, 440, 340], fill=(150, 110, 70))
    d.rectangle([450, 250, 495, 320], outline=(80, 80, 80), width=1)
    for label, xy in (("BED ROOM", (190, 170)), ("11'0\" x 9'2\"", (190, 186)),
                      ("LIVING/DINING", (410, 380)), ("KITCHEN", (225, 430)),
                      ("WC", (110, 320)), ("BATH", (190, 370)), ("BALCONY 4' WIDE", (400, 170))):
        d.text(xy, label, fill=(30, 30, 30), anchor="mm", font=_font(13))
    d.text((300, 600), "1 BHK", fill="black", anchor="mm", font=_font(34))
    d.line([120, 60, 262, 60], fill=(40, 40, 40), width=1)

    truth = [("master_bedroom", (80, 92, 295, 280)), ("living_room", (300, 225, 497, 537)),
             ("bathroom", (80, 285, 142, 388)), ("bathroom", (147, 343, 232, 402)),
             ("kitchen", (150, 407, 295, 537)), ("balcony", (305, 128, 492, 212))]
    return im, [(kind, [b[0] / WIDTH, b[1] / HEIGHT, b[2] / WIDTH, b[3] / HEIGHT]) for kind, b in truth]


def png_bytes(im: Image.Image) -> bytes:
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def iou(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union else 0.0
