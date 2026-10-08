"""Put the builder's hand-written layouts into the catalogue.

    cd backend
    .venv\\Scripts\\python scripts\\load_builder_typologies.py --check
    .venv\\Scripts\\python scripts\\load_builder_typologies.py

Replaces the placeholder catalogue layouts with the eight the builder supplied,
whose rooms are written out in app/services/builder_typologies.py to the
dimensions printed on their drawings.

Nothing here is read by the plan tracer. The rooms are already known exactly,
so each layout's plan cache is filled from its written-down geometry and the
drawing shown on the card is rendered from that same geometry -- which means
the picture a customer picks, the 2D plan and the 3D model cannot disagree.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.db import SessionLocal, init_db                      # noqa: E402
from app.models import FloorPlan, Flat, Project, Typology     # noqa: E402
from app.services.builder_typologies import ALL, Layout, check, to_plan  # noqa: E402

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")

# Floor tones per room type, so the drawing reads at card size without a key.
FILL = {
    "living_room": "#F3EADA", "dining_area": "#F3EADA", "kitchen": "#DCE7EC",
    "master_bedroom": "#EFE4D6", "bedroom": "#EFE4D6", "bathroom": "#D9E6E8",
    "balcony": "#E7EFE3", "terrace": "#E2ECDC", "passage": "#F1F1EE",
    "study": "#EFE4D6", "store": "#F1F1EE",
}
EDGE = "#2F3337"


def _font(size: int):
    for name in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render(layout: Layout, path: Path, px_per_m: int = 108) -> None:
    """Draw the layout as a floor plan: walls, rooms, names and sizes."""
    pad = 26
    w = int(layout.width_m * px_per_m) + pad * 2
    h = int(layout.depth_m * px_per_m) + pad * 2
    img = Image.new("RGB", (w, h), "white")
    d = ImageDraw.Draw(img)
    name_font, dim_font = _font(15), _font(12)

    for s in layout.spaces:
        x0 = pad + s.x * px_per_m
        y0 = pad + s.y * px_per_m
        x1 = pad + (s.x + s.w) * px_per_m
        y1 = pad + (s.y + s.h) * px_per_m
        outdoor = s.room_type in ("balcony", "terrace")
        d.rectangle([x0, y0, x1, y1], fill=FILL.get(s.room_type, "#F4F4F2"),
                    outline=EDGE, width=2 if outdoor else 5)

        label = s.label
        size = f"{s.w:.2f} x {s.h:.2f}"
        tw = d.textlength(label, font=name_font)
        sw = d.textlength(size, font=dim_font)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        # Only label a room with room for the words.
        if x1 - x0 > tw + 8 and y1 - y0 > 34:
            d.text((cx - tw / 2, cy - 16), label, fill="#1B1D1F", font=name_font)
            d.text((cx - sw / 2, cy + 2), size, fill="#6A7075", font=dim_font)
        elif x1 - x0 > sw + 6 and y1 - y0 > 16:
            d.text((cx - sw / 2, cy - 7), size, fill="#6A7075", font=dim_font)

    # The envelope, drawn last so it sits over the room edges.
    d.rectangle([pad, pad, w - pad, h - pad], outline=EDGE, width=6)
    img.save(path, format="PNG", optimize=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="validate and draw, write nothing to the database")
    args = ap.parse_args()

    problems = {lay.key: check(lay) for lay in ALL}
    if any(problems.values()):
        for key, probs in problems.items():
            for p in probs:
                print(f"  {key}: {p}")
        sys.exit("the written-down layouts do not validate; nothing was loaded")
    print(f"{len(ALL)} layouts validate\n")

    plan_dir = BACKEND / "assets" / "floor_plans"
    plan_dir.mkdir(parents=True, exist_ok=True)
    drawn = 0
    for lay in ALL:
        target = plan_dir / f"builder_{lay.key}.png"
        # The builder's own sheet, rasterised by render_builder_pdfs.py, is what
        # the customer should see. A schematic is drawn only where that sheet is
        # not available on this machine, so this never paints over the real one.
        if target.exists():
            continue
        render(lay, target)
        drawn += 1
    print(f"{len(ALL) - drawn} layouts use the builder's own drawing, "
          f"{drawn} fell back to a schematic")

    if args.check:
        print("\n--check: database untouched")
        return

    init_db()
    db = SessionLocal()
    try:
        # The placeholder catalogue goes. Anything pointing at one is cleared
        # first, so no customer is left holding a layout that no longer exists.
        keep = {lay.name for lay in ALL}
        stale = [t for t in db.query(Typology).filter(Typology.project_id.is_(None)).all()
                 if t.name not in keep]
        if stale:
            ids = {t.id for t in stale}
            cleared = 0
            for proj in db.query(Project).filter(Project.typology_id.in_(ids)).all():
                proj.typology_id, proj.plan_layout = None, None
                cleared += 1
            for flat in db.query(Flat).filter(Flat.typology_id.in_(ids)).all():
                flat.typology_id = None
            for t in stale:
                db.delete(t)
            db.commit()
            print(f"removed {len(stale)} placeholder layouts ({cleared} projects reset)")

        for lay in ALL:
            row = db.query(Typology).filter(Typology.name == lay.name,
                                            Typology.project_id.is_(None)).first()
            if row is None:
                row = Typology(project_id=None, name=lay.name)
                db.add(row)
                db.flush()

            stored = f"builder_{lay.key}.png"
            url = f"{BACKEND_URL}/static/assets/floor_plans/{stored}"
            plan_row = db.query(FloorPlan).filter(FloorPlan.file_url == url).first()
            if plan_row is None:
                plan_row = FloorPlan(project_id=None, file_url=url,
                                     file_type="png", uploaded_by="builder")
                db.add(plan_row)
                db.flush()

            row.bhk_type = lay.bhk
            row.carpet_area_sqft = lay.carpet_area_sqft
            row.description = lay.description
            row.floor_plan_id = plan_row.id
            row.image_url = url
            # Written down, not traced: the rooms are already exact.
            row.plan_cache = {**to_plan(lay), "image_url": url}
            print(f"  {lay.name:30} {lay.bhk}  {lay.carpet_area_sqft:6.0f} sqft  "
                  f"{len(lay.spaces):2d} rooms")
        db.commit()
        print(f"\n{len(ALL)} builder layouts loaded")
    finally:
        db.close()


if __name__ == "__main__":
    main()
