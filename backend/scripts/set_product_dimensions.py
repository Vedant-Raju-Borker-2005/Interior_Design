"""Give catalogue products their real sizes.

    cd backend
    .venv\\Scripts\\python scripts\\set_product_dimensions.py --check
    .venv\\Scripts\\python scripts\\set_product_dimensions.py

Every product was seeded with the column default of 1200 x 600 x 750 mm, so a
wardrobe, a bedside table and a rug all claimed to be the same size. Anything
that asks whether a piece fits a room — the recommendation engine, the catalogue
filter, the spatial feasibility badge — was working from that one fake number.

Sizes come from app/services/product_dimensions.py, which holds the same
measurements the 3D room templates use, so the catalogue and the model agree.
Only width, depth and height are touched; prices, images and names are not.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")
from app.services.product_dimensions import dimensions_for  # noqa: E402

TABLES = ("products", "vendor_products")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="show what would change, write nothing")
    args = ap.parse_args()

    url = os.getenv("DATABASE_URL", "")
    if not url:
        sys.exit("DATABASE_URL is not set in backend/.env")
    engine = create_engine(url, connect_args={"connect_timeout": 30} if "postgres" in url else {})
    print("database:", engine.url.host or url)

    insp = inspect(engine)
    live = set(insp.get_table_names())
    total_changed = 0

    for table in TABLES:
        if table not in live:
            continue
        columns = {c["name"] for c in insp.get_columns(table)}
        if not {"width", "depth", "height"} <= columns:
            print(f"  {table}: no size columns, skipped")
            continue

        with engine.connect() as conn:
            rows = conn.execute(text(
                f"SELECT id, name, category, subcategory, width, depth, height FROM {table}")).all()

        updates = []
        for row in rows:
            want = dimensions_for(row.name, row.category, row.subcategory)
            have = (int(row.width or 0), int(row.depth or 0), int(row.height or 0))
            if have != want:
                updates.append((row.id, row.name, have, want))

        print(f"\n  {table}: {len(rows)} rows, {len(updates)} to resize")
        for _id, name, have, want in updates[:6]:
            print(f"     {str(name)[:38]:40} {have[0]}x{have[1]} -> {want[0]}x{want[1]} mm")
        if len(updates) > 6:
            print(f"     ... and {len(updates) - 6} more")

        if updates and not args.check:
            with engine.begin() as conn:
                for _id, _name, _have, want in updates:
                    conn.execute(text(
                        f"UPDATE {table} SET width=:w, depth=:d, height=:h WHERE id=:i"),
                        {"w": want[0], "d": want[1], "h": want[2], "i": _id})
            total_changed += len(updates)

    if args.check:
        print("\n--check: nothing written")
        return

    print(f"\nresized {total_changed} rows")
    with engine.connect() as conn:
        spread = conn.execute(text(
            "SELECT width, depth, COUNT(*) FROM products GROUP BY width, depth ORDER BY 3 DESC")).all()
    print("sizes now in the catalogue:")
    for w, d, n in spread:
        print(f"   {int(w or 0)} x {int(d or 0)} mm -> {n}")


if __name__ == "__main__":
    main()
