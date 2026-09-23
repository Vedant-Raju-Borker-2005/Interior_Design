"""Draft ground truth for the floor-plan dataset from what OCR read.

Pairs every room-name word with the dimension text nearest to it and converts
that to an area in m². The draft is then corrected by hand.

    cd backend
    .venv\\Scripts\\python scripts\\plan_gt_draft.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.services.plan_ocr import parse_dimensions  # noqa: E402

DATA = BACKEND / "plan_dataset"

# Room words as they appear on Indian builder plans, mapped to the scene's types.
ROOM_WORDS = [
    ("master bedroom", "master_bedroom"), ("m.bedroom", "master_bedroom"), ("mbedroom", "master_bedroom"),
    ("daughter's bedroom", "bedroom"), ("bedroom", "bedroom"), ("bed room", "bedroom"), ("bed", "bedroom"),
    ("living/dining", "living_room"), ("living / dining", "living_room"), ("livingroom", "living_room"),
    ("drawing/dining", "living_room"), ("drg. room", "living_room"), ("living", "living_room"),
    ("dining", "dining_area"), ("kitchen/dining", "kitchen"), ("kitchen", "kitchen"), ("kit", "kitchen"),
    ("master bathroom", "bathroom"), ("common bathroom", "bathroom"), ("bathroom", "bathroom"),
    ("m.toilet", "bathroom"), ("m toilet", "bathroom"), ("c.toi", "bathroom"), ("m.toi", "bathroom"),
    ("toilet", "bathroom"), ("w.c/bath", "bathroom"), ("w.c", "bathroom"), ("bath", "bathroom"),
    ("dry balc", "balcony"), ("balcony", "balcony"), ("balc", "balcony"), ("sitout", "balcony"),
    ("deck", "balcony"), ("yard", "balcony"), ("ut. bal", "balcony"),
    ("utility", "utility"), ("wash", "utility"), ("store", "storage"), ("wardrobe", "storage"),
    ("foyer", "foyer"), ("entrance foyer", "foyer"), ("passage", "passage"), ("corridor", "passage"),
    ("study", "study"),
]

AREA_M2 = re.compile(r"^(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:m2|m²|sq\.?m)\.?$", re.I)   # 11.37m2
AREA_SQFT = re.compile(r"^(\d{3,5})\s*sq\.?\s*ft\.?$", re.I)                      # 1580 sq.ft.
BARE = re.compile(r"^(\d{1,2}[.,]\d{1,2})$")     # 11.10 — an area on colour-coded plans


def parse_dim(text: str):
    """Return (kind, area_m2, w, d) or None. Sizes come back in metres.

    Room sizes use the product's own parser, so the ground truth is built from
    exactly the text the app can read."""
    t = text.strip()
    m = AREA_M2.match(t)
    if m:
        v = float(m.group(1).replace(",", "."))
        return ("area", v, None, None) if 0.5 <= v <= 120 else None
    m = AREA_SQFT.match(t)
    if m:
        return ("total_sqft", round(int(m.group(1)) * 0.092903, 1), None, None)
    sides = parse_dimensions(t)
    if len(sides) == 2:
        return ("size", round(sides[0] * sides[1], 2), round(sides[0], 2), round(sides[1], 2))
    m = BARE.match(t)
    if m:
        v = float(m.group(1).replace(",", "."))
        return ("bare", v, None, None) if 1.0 <= v <= 60 else None
    return None


def room_type(text: str):
    t = re.sub(r"[^a-z/.' ]", " ", text.lower())
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"^\d+\s*[-.]\s*", "", t)               # "1-LIVING ROOM"
    for word, kind in ROOM_WORDS:
        if word in t or word.replace(" ", "") in t.replace(" ", ""):
            return kind
    return None


def main() -> None:
    ocr = json.loads((DATA / "ocr_raw.json").read_text(encoding="utf-8"))
    manifest = json.loads((DATA / "manifest.json").read_text(encoding="utf-8"))
    draft = {}
    for entry in manifest:
        items = ocr[entry["id"]]
        boxes = [{"t": it["t"], "x": (it["box"][0] + it["box"][2]) / 2,
                  "y": (it["box"][1] + it["box"][3]) / 2, "box": it["box"]} for it in items]
        near_x, near_y = entry["width"] * 0.10, entry["height"] * 0.10
        dims = [(b, parse_dim(b["t"])) for b in boxes]
        names = [(b, room_type(b["t"])) for b in boxes]
        used, rooms = set(), []
        for b, kind in names:
            if not kind:
                continue
            best, best_d = None, 1e9
            for db, parsed in dims:
                if not parsed or parsed[0] not in ("size", "area") or id(db) in used:
                    continue
                dx, dy = abs(db["x"] - b["x"]), db["y"] - b["y"]
                if dy < -near_y * 0.3 or abs(dy) > near_y or dx > near_x:  # the size sits under its name
                    continue
                d = abs(dy) + dx
                if d < best_d:
                    best, best_d = (db, parsed), d
            room = {"type": kind, "label_text": b["t"]}
            if best:
                used.add(id(best[0]))
                room["area_m2"] = best[1][1]
                if best[1][2]:
                    room["size_m"] = [best[1][2], best[1][3]]
                room["dim_text"] = best[0]["t"]
            rooms.append(room)
        loose = [round(p[1], 2) for b, p in dims if p and p[0] in ("area", "bare") and id(b) not in used]
        total = next((p[1] for b, p in dims if p and p[0] == "total_sqft"), None)
        draft[entry["id"]] = {
            "file": entry["file"], "rooms": rooms,
            "unmatched_areas_m2": loose,
            "printed_total_area_m2": total,
            "sub_plans": 1, "notes": "",
        }
        named = sum(1 for r in rooms if "area_m2" in r)
        print(f'{entry["id"]}  rooms {len(rooms):2d} (with size {named:2d})  loose areas {len(loose):2d}'
              f'  total {total or "-"}')
    (DATA / "gt_draft.json").write_text(json.dumps(draft, indent=1), encoding="utf-8")
    print("\nwrote", DATA / "gt_draft.json")


if __name__ == "__main__":
    main()
