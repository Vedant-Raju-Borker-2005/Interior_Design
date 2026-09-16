"""Read the printed room labels and dimensions on a floor plan.

Wall tracing finds the *shapes* of rooms; this module reads what the plan says
about them — "BEDROOM 3*4.5M", "KITCHEN 7'0" x 6'2"", "1.2M WIDE PASSAGE" — so
each shape gets its real name and type, and the plan gets its true scale from
the printed sizes instead of an estimate.

OCR runs offline (RapidOCR on ONNX Runtime). If it isn't installed, everything
here degrades to "no labels found" and detection falls back to shape-only rules.
"""
from __future__ import annotations

import math
import re
import threading
from dataclasses import dataclass, field
from typing import Any, Optional

import numpy as np
from PIL import Image

_ENGINE: dict[str, Any] = {"ocr": None, "failed": False}
_LOCK = threading.Lock()


def ocr_available() -> bool:
    try:
        import rapidocr_onnxruntime  # noqa: F401
        return not _ENGINE["failed"]
    except Exception:
        return False


def _engine():
    """Load the OCR model once; it takes a few seconds on a slow machine."""
    with _LOCK:
        if _ENGINE["ocr"] is None and not _ENGINE["failed"]:
            try:
                from rapidocr_onnxruntime import RapidOCR
                _ENGINE["ocr"] = RapidOCR()
            except Exception:
                _ENGINE["failed"] = True
        return _ENGINE["ocr"]


def warm_up_in_background() -> None:
    """Start loading the model so the customer's upload doesn't wait for it."""
    if _ENGINE["ocr"] is None and not _ENGINE["failed"] and ocr_available():
        threading.Thread(target=_engine, name="plan-ocr-warmup", daemon=True).start()


@dataclass
class Text:
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    score: float

    @property
    def cx(self) -> float:
        return (self.x0 + self.x1) / 2

    @property
    def cy(self) -> float:
        return (self.y0 + self.y1) / 2

    @property
    def h(self) -> float:
        return self.y1 - self.y0


@dataclass
class Label:
    room_type: str
    name: str
    cx: float                      # image fractions
    cy: float
    dims_m: list[float] = field(default_factory=list)   # 2 values (a × b) or 1 (width only)
    texts: list[str] = field(default_factory=list)


def read_texts(img: Image.Image) -> list[Text]:
    engine = _engine()
    if engine is None:
        return []
    w, h = img.size
    scale = 1.0
    if max(w, h) > 1800:
        scale = 1800 / max(w, h)
    elif max(w, h) < 900:
        scale = min(2.0, 1200 / max(w, h))     # small plans read better enlarged
    work = img if scale == 1.0 else img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    arr = np.asarray(work.convert("RGB"))[:, :, ::-1].copy()   # BGR, as OpenCV expects
    try:
        result, _ = engine(arr)
    except Exception:
        return []
    texts = []
    for box, text, score in result or []:
        xs = [p[0] / scale for p in box]
        ys = [p[1] / scale for p in box]
        if text and float(score) >= 0.5:
            texts.append(Text(str(text).strip(), min(xs), min(ys), max(xs), max(ys), float(score)))
    return texts


# ═════════════════════════════════════════════════════════ text → meaning ═════
# Most specific first. Matched against the letters of a text with spaces and
# punctuation removed, because OCR often drops spaces ("LIVING+DINING").
_ROOM_WORDS: list[tuple[str, str, str]] = [
    ("MASTERBEDROOM", "master_bedroom", "Master Bedroom"), ("MASTERBED", "master_bedroom", "Master Bedroom"),
    ("GUESTBEDROOM", "bedroom", "Guest Bedroom"), ("KIDSBEDROOM", "bedroom", "Kids Bedroom"),
    ("CHILDRENBEDROOM", "bedroom", "Children's Bedroom"),
    ("BEDROOM", "bedroom", "Bedroom"), ("BEDRM", "bedroom", "Bedroom"),
    ("LIVINGDINING", "living_room", "Living + Dining"), ("LIVINGROOM", "living_room", "Living Room"),
    ("LIVING", "living_room", "Living Room"), ("DRAWINGROOM", "living_room", "Drawing Room"),
    ("DRAWING", "living_room", "Drawing Room"), ("HALL", "living_room", "Hall"),
    ("LOUNGE", "family_lounge", "Lounge"), ("FAMILY", "family_lounge", "Family Lounge"),
    ("DINING", "dining_area", "Dining"),
    ("KITCHEN", "kitchen", "Kitchen"), ("PANTRY", "kitchen", "Pantry"),
    ("TOILET", "bathroom", "Toilet"), ("BATHROOM", "bathroom", "Bathroom"), ("BATH", "bathroom", "Bath"),
    ("WASHROOM", "bathroom", "Washroom"), ("POWDER", "bathroom", "Powder Room"),
    ("BALCONY", "balcony", "Balcony"), ("SITOUT", "balcony", "Sit-out"), ("TERRACE", "balcony", "Terrace"),
    ("VERANDAH", "balcony", "Verandah"), ("VERANDA", "balcony", "Veranda"), ("DECK", "balcony", "Deck"),
    ("PASSAGE", "passage", "Passage"), ("CORRIDOR", "passage", "Corridor"), ("LOBBY", "passage", "Lobby"),
    ("FOYER", "passage", "Foyer"), ("UTILITY", "passage", "Utility"), ("WASH", "passage", "Wash Area"),
    ("STORE", "passage", "Store"), ("DRESS", "passage", "Dressing"),
    ("STUDY", "study", "Study"), ("OFFICE", "study", "Home Office"),
    ("POOJA", "pooja_room", "Pooja Room"), ("PUJA", "pooja_room", "Pooja Room"), ("MANDIR", "pooja_room", "Pooja Room"),
]
_SHORT_WORDS = {"WC": ("bathroom", "WC"), "WCS": ("bathroom", "WC"), "KIT": ("kitchen", "Kitchen"),
                "BAT": ("bathroom", "Bath"), "TLT": ("bathroom", "Toilet"),
                "BED": ("bedroom", "Bedroom"), "BR": ("bedroom", "Bedroom")}
_NOT_ROOMS = ("FLOOR", "PLAN", "FLAN", "BHK", "AREA", "SQFT", "SQM", "MSQ", "UNIT", "SCALE", "NORTH", "TOWER",
              "WING", "CARPET", "BUILTUP", "SUPER")


def _letters(text: str) -> str:
    return re.sub(r"[^A-Z]", "", text.upper())


def room_word(text: str) -> Optional[tuple[str, str]]:
    letters = _letters(text)
    if not letters or any(w in letters for w in _NOT_ROOMS):
        return None
    for word, room_type, name in _ROOM_WORDS:
        if word in letters:
            return room_type, name
    tokens = re.findall(r"[A-Z]+", text.upper().replace(".", ""))
    for token in tokens:
        if token in _SHORT_WORDS:
            return _SHORT_WORDS[token]
    return None


def _feet(value: str, inches: Optional[str]) -> float:
    ft = float(value)
    inch = float(inches) if inches else 0.0
    if inches is None and ft >= 30 and float(value).is_integer():
        # OCR drops the foot mark: 110" is 11'0", 92 is 9'2".
        ft, inch = divmod(int(ft), 10)
    return (ft + inch / 12) * 0.3048


def _sane(dims: list[float]) -> list[float]:
    """A room side is between 0.5 m and 15 m; anything else is a misread."""
    return dims if all(0.5 <= d <= 15 for d in dims) else []


def parse_dimensions(text: str) -> list[float]:
    """Room size in metres from a label: [a, b] for "3.1*1.9", [w] for "1.2M WIDE"."""
    t = text.upper().replace("×", "X").replace("’", "'").replace("”", '"').replace("″", '"').replace("′", "'")
    t = t.replace(" ", "")

    # Feet and inches: 11'0"X9'2", 12'-6"X10', 10'X15'9"
    feet = re.search(r"(\d+(?:\.\d+)?)'-?(\d+(?:\.\d+)?)?['\"]?X(\d+(?:\.\d+)?)'-?(\d+(?:\.\d+)?)?['\"]?", t)
    if feet:
        return _sane([_feet(feet.group(1), feet.group(2)), _feet(feet.group(3), feet.group(4))])
    # OCR'd without foot marks but with inch marks: 110"X9'2"  or 10"X15.9"
    loose_ft = re.search(r"(\d+(?:\.\d+)?)[\"']X(\d+(?:\.\d+)?)[\"']?(\d+)?", t)
    if loose_ft:
        a = _feet(loose_ft.group(1), None)
        b_val, b_in = loose_ft.group(2), loose_ft.group(3)
        if b_in is None and "." in b_val:      # 15.9" written for 15'9"
            ft, inch = b_val.split(".", 1)
            b = _feet(ft, inch)
        else:
            b = _feet(b_val, b_in)
        return _sane([a, b])

    # Metric: 3.1*1.9, 3*4.5M, 3.4X6.7, 3100X1900 (mm)
    metric = re.search(r"(\d+(?:\.\d+)?)M?[*X](\d+(?:\.\d+)?)M?", t)
    if metric:
        a, b = float(metric.group(1)), float(metric.group(2))
        if a >= 500 and b >= 500:
            a, b = a / 1000, b / 1000
        return [a, b] if 0.5 <= a <= 15 and 0.5 <= b <= 15 else []
    # OCR ate the multiply sign: "3.11.9" is 3.1*1.9
    fused = re.fullmatch(r"(\d+\.\d)(\d+\.\d+)M?", t)
    if fused:
        return [float(fused.group(1)), float(fused.group(2))]

    # One dimension: "1.2M WIDE", "4' WIDE", "4WIDE"
    wide = re.search(r"(\d+(?:\.\d+)?)(M|'|FT)?WIDE", t)
    if wide:
        v = float(wide.group(1))
        unit = wide.group(2)
        metres = v if unit == "M" else v * 0.3048 if unit in ("'", "FT") or v > 2.5 else v
        return [metres] if 0.5 <= metres <= 6 else []
    return []


def build_labels(texts: list[Text], img_w: int, img_h: int) -> list[Label]:
    """Group each room name with the dimension text printed next to it."""
    names, dims = [], []
    for t in texts:
        rw = room_word(t.text)
        d = parse_dimensions(t.text)
        if rw:
            names.append((t, rw, d))
        elif d:
            dims.append((t, d))
    labels: list[Label] = []
    used: set[int] = set()
    for t, (room_type, name), own_dims in names:
        best, best_score = None, None
        for i, (dt, d) in enumerate(dims):
            if i in used:
                continue
            line = max(t.h, dt.h, 1.0)
            dy = min(abs(dt.y0 - t.y1), abs(t.y0 - dt.y1))
            dx = abs(dt.cx - t.cx) if not (dt.x1 >= t.x0 and dt.x0 <= t.x1) else 0.0
            if dy > 1.6 * line or dx > 4 * line:
                continue
            score = dy + dx
            if best_score is None or score < best_score:
                best, best_score = i, score
        found = list(own_dims)
        texts_used = [t.text]
        cx, cy = t.cx, t.cy
        if best is not None:
            used.add(best)
            dt, d = dims[best]
            if len(d) == 2 or not found:
                found = d if len(d) == 2 else (found or d)
            texts_used.append(dt.text)
            cx, cy = (t.cx + dt.cx) / 2, (t.cy + dt.cy) / 2
        labels.append(Label(room_type, name, cx / img_w, cy / img_h, found, texts_used))
    return labels


# ═════════════════════════════════════════════════════════ labels ↔ shapes ═════
def _fit_ppm(box_px: tuple[float, float], dims: list[float]) -> Optional[tuple[float, float]]:
    """(pixels per metre, disagreement) for a room of box_px drawn at dims."""
    w, h = box_px
    if w <= 0 or h <= 0:
        return None
    if any(d <= 0 for d in dims):
        return None
    if len(dims) == 2:
        a, b = dims
        options = [(w / a, h / b), (w / b, h / a)]
        best = min(options, key=lambda o: abs(math.log(o[0] / o[1])))
        disagreement = abs(math.log(best[0] / best[1]))
        return math.sqrt(best[0] * best[1]), disagreement
    if len(dims) == 1:
        return min(w, h) / dims[0], 0.25            # a "wide" size fixes the short side only
    return None


def apply_labels(detection: dict[str, Any], img: Image.Image, texts: Optional[list[Text]] = None,
                 labels: Optional[list[Label]] = None) -> dict[str, Any]:
    """Name detected rooms from the plan's printed labels and set the scale
    from printed sizes. Returns the detection, updated in place."""
    if texts is None:
        if not ocr_available():
            return detection
        texts = read_texts(img)
    W, H = img.size
    if labels is None:
        labels = build_labels(texts, W, H)
    detection["labels_read"] = [{"name": l.name, "type": l.room_type, "dims_m": [round(v, 2) for v in l.dims_m],
                                 "text": " ".join(l.texts)} for l in labels]
    if not labels:
        return detection

    rooms = detection.get("rooms") or []
    wall = float(detection.get("wall_frac", 0.0))       # wall thickness as a fraction of image width

    def contains(box, lab, pad=0.01):
        return box[0] - pad <= lab.cx <= box[2] + pad and box[1] - pad <= lab.cy <= box[3] + pad

    # Each shape takes the label inside it; with several, the one whose printed
    # size fits the shape best (a stray label from a neighbouring room loses).
    claimed: dict[int, Label] = {}
    outside_labels: list[Label] = []
    for lab in labels:
        inside = [i for i, r in enumerate(rooms) if contains(r["box"], lab, pad=0.0)] or \
                 [i for i, r in enumerate(rooms) if contains(r["box"], lab)]
        if not inside:
            outside_labels.append(lab)
            continue
        i = min(inside, key=lambda k: (rooms[k]["box"][2] - rooms[k]["box"][0]) * (rooms[k]["box"][3] - rooms[k]["box"][1]))
        prev = claimed.get(i)
        if prev is None or _label_fit(rooms[i]["box"], lab, W, H) < _label_fit(rooms[i]["box"], prev, W, H):
            claimed[i] = lab

    # A label printed just beside its room ("WC 1.1*1.4M" outside the WC):
    # give it to the nearest unnamed room of a fitting size.
    for lab in outside_labels:
        best, best_d = None, None
        for i, r in enumerate(rooms):
            if i in claimed:
                continue
            x0, y0, x1, y1 = r["box"]
            dx = max(x0 - lab.cx, 0.0, lab.cx - x1)
            dy = max(y0 - lab.cy, 0.0, lab.cy - y1)
            d = math.hypot(dx, dy * H / W)
            if d <= 0.08 and (best_d is None or d + 0.02 * _label_fit(r["box"], lab, W, H) < best_d):
                best, best_d = i, d + 0.02 * _label_fit(r["box"], lab, W, H)
        if best is not None:
            claimed[best] = lab

    sizes: list[tuple[float, float, float, float]] = []
    for i, lab in claimed.items():
        box = rooms[i]["box"]
        inner = ((box[2] - box[0] - wall) * W, (box[3] - box[1] - wall * W / H) * H)
        if len(lab.dims_m) == 2 and inner[0] > 0 and inner[1] > 0 and min(lab.dims_m) > 0:
            sizes.append((inner[0], inner[1], lab.dims_m[0], lab.dims_m[1]))
        rooms[i]["room_type"] = lab.room_type
        rooms[i]["label"] = lab.name
        rooms[i]["from_label"] = True

    scales = solve_scales(sizes)
    ppms = []
    if scales:
        sx, sy = scales
        ppms = [sx]
        detection["plan_width_m"] = round(W / sx, 2)
        detection["plan_depth_m"] = round(H / sy, 2)
        detection["scale_source"] = "printed sizes"
        if abs(math.log(sx / sy)) > 0.1:
            detection.setdefault("notes", []).append(
                "This image looks stretched; the room sizes were corrected using the printed dimensions.")

    # On a labelled plan an unlabelled space is circulation (a lobby, a duct,
    # the landing) — not a guessed kitchen or bedroom.
    if len(claimed) >= 2:
        named_types = {lab.room_type for lab in claimed.values()}
        largest = max(((r["box"][2] - r["box"][0]) * (r["box"][3] - r["box"][1]) for r in rooms), default=1.0)
        for i, r in enumerate(rooms):
            if i in claimed:
                continue
            w, d = (r["box"][2] - r["box"][0]) * W, (r["box"][3] - r["box"][1]) * H
            area = (r["box"][2] - r["box"][0]) * (r["box"][3] - r["box"][1])
            long_narrow = max(w, d) >= 2.2 * min(w, d)
            if r.get("tiled") and long_narrow and "balcony" not in named_types:
                r["room_type"], r["label"] = "balcony", "Balcony"       # a long tiled strip: the balcony
            elif r.get("tiled") and area < 0.25 * largest:
                r["room_type"], r["label"] = "bathroom", "Bathroom"     # an unlabelled tiled cell: a WC
            elif r["room_type"] == "balcony" and "balcony" not in named_types:
                continue                                              # the plan names no balcony: keep the guess
            else:
                r["room_type"], r["label"] = "passage", "Passage"

    # Only one bedroom, or one printed as master: that's the master bedroom.
    beds = [r for r in rooms if r["room_type"] in ("bedroom", "master_bedroom")]
    if beds and not any(r["room_type"] == "master_bedroom" for r in beds):
        largest = max(beds, key=lambda r: (r["box"][2] - r["box"][0]) * (r["box"][3] - r["box"][1]))
        largest["room_type"] = "master_bedroom"
        if largest.get("label") in (None, "Bedroom") and len(beds) > 1:
            largest["label"] = "Master Bedroom"

    # Two rooms printed with the same name ("BALCONY" twice) get numbered.
    seen: dict[str, int] = {}
    for r in rooms:
        name = r.get("label") or ""
        seen[name] = seen.get(name, 0) + 1
        if seen[name] > 1:
            r["label"] = f"{name} {seen[name]}"

    named = sum(1 for r in rooms if r.get("from_label"))
    notes = [n for n in detection.get("notes", []) if "estimate" not in n]
    if named:
        notes.insert(0, f"Read {named} room name{'s' if named != 1 else ''} from your plan"
                        + (" and set the scale from the printed sizes." if ppms else "."))
    detection["notes"] = notes
    return detection


def solve_scales(sizes: list[tuple[float, float, float, float]]) -> Optional[tuple[float, float]]:
    """Pixels per metre across and down the image, from rooms whose printed
    size is known: (w_px, h_px, a_m, b_m) each, orientation unknown.

    Uploaded plans are often resized unevenly (a screenshot stretched to fit),
    so the two directions are solved separately — but only when at least two
    rooms agree on the stretch; otherwise one common scale is used."""
    if not sizes:
        return None
    iso = []
    for w, h, a, b in sizes:
        fit = _fit_ppm((w, h), [a, b])
        if fit and fit[1] <= 0.6:
            iso.append(fit[0])
    if not iso:
        return None
    sx = sy = float(np.median(iso))
    used = 0
    for _ in range(4):
        xs, ys = [], []
        for w, h, a, b in sizes:
            options = [(w / a, h / b), (w / b, h / a)]
            err = lambda o: abs(math.log(o[0] / sx)) + abs(math.log(o[1] / sy))  # noqa: E731
            best = min(options, key=err)
            if err(best) <= 0.8:
                xs.append(best[0])
                ys.append(best[1])
        if not xs:
            break
        sx, sy, used = float(np.median(xs)), float(np.median(ys)), len(xs)
    if used < 2 or abs(math.log(sx / sy)) <= 0.08:
        s = math.sqrt(sx * sy)
        # One room only, or no real stretch: keep the image's own proportions.
        consistent = [v for v in iso if abs(math.log(v / s)) <= 0.35] or iso
        s = float(np.median(consistent))
        return s, s
    return sx, sy


def _label_fit(box, lab: Label, W: int, H: int) -> float:
    if len(lab.dims_m) != 2:
        return 1.0
    w, h = (box[2] - box[0]) * W, (box[3] - box[1]) * H
    a, b = lab.dims_m
    return min(abs(math.log((w / h) / (a / b))), abs(math.log((w / h) / (b / a))))
