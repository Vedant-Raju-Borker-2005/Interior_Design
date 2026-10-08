"""Read every layout's floor plan once, so choosing one is instant.

    cd backend
    .venv\\Scripts\\python scripts\\warm_typology_plans.py            # read what is unread
    .venv\\Scripts\\python scripts\\warm_typology_plans.py --refresh  # read everything again
    .venv\\Scripts\\python scripts\\warm_typology_plans.py --samples  # also give the
                                                                     # catalogue layouts
                                                                     # sample drawings

Reading a plan takes tens of seconds. The answer depends only on the drawing,
so it is cached on the layout and every customer who picks that layout gets
their rooms immediately. Run this after a builder uploads their layouts, and
the first customer never waits.

--samples attaches the sample brochure plans in plan_dataset/images to the
catalogue layouts that have no drawing of their own. It is for demonstrating
the flow before a builder's own drawings are loaded; a layout that already has
a drawing is never touched.
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.db import SessionLocal, init_db           # noqa: E402
from app.models import FloorPlan, Typology         # noqa: E402
from app.services import typology_plan             # noqa: E402

# A sample drawing per catalogue layout, chosen to match its configuration.
SAMPLES: dict[str, str] = {
    "1 BHK Compact": "plan_03.jpg",
    "1 BHK Wide":    "plan_12.jpg",
    "2 BHK Type A":  "plan_00.jpg",
    "2 BHK Type B":  "plan_01.jpg",
    "2 BHK Corner":  "plan_09.jpg",
    "3 BHK Type A":  "plan_04.jpg",
    "3 BHK Type B":  "plan_07.jpg",
}

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")


def attach_samples(db) -> int:
    """Give catalogue layouts without a drawing one of the sample plans."""
    source_dir = BACKEND / "plan_dataset" / "images"
    target_dir = BACKEND / "assets" / "floor_plans"
    target_dir.mkdir(parents=True, exist_ok=True)
    attached = 0

    for name, filename in SAMPLES.items():
        row = db.query(Typology).filter(Typology.name == name,
                                        Typology.project_id.is_(None)).first()
        if row is None:
            print(f"  {name:16} no such catalogue layout, skipped")
            continue
        if row.floor_plan_id or row.plan_cache:
            print(f"  {name:16} already has a drawing, left alone")
            continue
        source = source_dir / filename
        if not source.exists():
            print(f"  {name:16} {filename} is missing, skipped")
            continue

        stored = f"typology_{row.id[:8]}{source.suffix}"
        shutil.copyfile(source, target_dir / stored)
        plan = FloorPlan(project_id=None,
                         file_url=f"{BACKEND_URL}/static/assets/floor_plans/{stored}",
                         file_type=source.suffix.lstrip("."),
                         uploaded_by="sample")
        db.add(plan)
        db.flush()
        row.floor_plan_id = plan.id
        attached += 1
        print(f"  {name:16} <- {filename}")

    db.commit()
    return attached


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="re-read layouts already read")
    ap.add_argument("--samples", action="store_true",
                    help="give catalogue layouts sample drawings first")
    args = ap.parse_args()

    init_db()
    db = SessionLocal()
    try:
        if args.samples:
            print("attaching sample drawings:")
            print(f"  {attach_samples(db)} attached\n")

        rows = db.query(Typology).all()
        print(f"reading {len(rows)} layouts:")
        read = skipped = failed = 0
        for row in rows:
            if row.plan_cache and not args.refresh:
                skipped += 1
                continue
            if not typology_plan.plan_image_path(row):
                print(f"  {row.name:16} no drawing")
                skipped += 1
                continue
            started = time.perf_counter()
            plan = typology_plan.ensure_plan(db, row, refresh=args.refresh)
            took = time.perf_counter() - started
            if plan:
                read += 1
                print(f"  {row.name:16} {len(plan['rooms'])} rooms, "
                      f"{plan['plan_width_m']} m wide, {took:.1f}s")
            else:
                failed += 1
                print(f"  {row.name:16} could not be read ({took:.1f}s)")

        print(f"\nread {read}, already done {skipped}, unreadable {failed}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
