"""Copy one Postgres database into another — used to move the project to a nearer region.

    cd backend
    # SOURCE_DATABASE_URL = the old project, DATABASE_URL = the new one
    .venv\\Scripts\\python scripts\\copy_postgres_to_postgres.py --check    # just compare
    .venv\\Scripts\\python scripts\\copy_postgres_to_postgres.py            # empty target only
    .venv\\Scripts\\python scripts\\copy_postgres_to_postgres.py --replace  # overwrite target rows

Supabase cannot move a project between regions, so the move is: create a new
project in the region you want, put its connection string in backend/.env as
DATABASE_URL, put the old one in SOURCE_DATABASE_URL, and run this.

Every table is copied inside one transaction with foreign-key checks paused, so
a failure leaves the target untouched. The source is only ever read from.
"""
from __future__ import annotations

import argparse
import sys
import time
import warnings
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import SAWarning

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.models import Base  # noqa: E402

# A batch keeps the round trips down: over a long link, inserting row by row is
# what makes a copy like this take hours instead of a minute.
BATCH = 500


def _urls() -> tuple[str, str]:
    env = dotenv_values(BACKEND / ".env")
    source = env.get("SOURCE_DATABASE_URL") or ""
    target = env.get("DATABASE_URL") or ""
    if not source.startswith("postgres"):
        sys.exit("backend/.env needs SOURCE_DATABASE_URL set to the old Postgres database")
    if not target.startswith("postgres"):
        sys.exit("backend/.env needs DATABASE_URL set to the new Postgres database")
    if source == target:
        sys.exit("SOURCE_DATABASE_URL and DATABASE_URL are the same database")
    return source, target


def _counts(engine, tables) -> dict[str, int]:
    with engine.connect() as conn:
        return {t.name: conn.execute(select(func.count()).select_from(t)).scalar() or 0 for t in tables}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--replace", action="store_true", help="empty the target tables first")
    parser.add_argument("--check", action="store_true", help="only compare the two databases")
    args = parser.parse_args()

    source_url, target_url = _urls()
    source = create_engine(source_url, connect_args={"connect_timeout": 30})
    target = create_engine(target_url, connect_args={"connect_timeout": 30})

    with warnings.catch_warnings():
        # Several tables reference each other; with foreign-key checks paused
        # for the copy, the order they go in does not matter.
        warnings.simplefilter("ignore", SAWarning)
        tables = Base.metadata.sorted_tables

    print(f"source: {create_engine(source_url).url.host}")
    print(f"target: {create_engine(target_url).url.host}\n")

    src_counts = _counts(source, tables)
    Base.metadata.create_all(target)
    dst_counts = _counts(target, tables)

    if args.check:
        print(f"{'table':32}{'source':>9}{'target':>9}")
        for name in sorted(src_counts):
            if src_counts[name] or dst_counts[name]:
                same = "" if src_counts[name] == dst_counts[name] else "   differs"
                print(f"{name:32}{src_counts[name]:9d}{dst_counts[name]:9d}{same}")
        return

    if any(dst_counts.values()) and not args.replace:
        busy = ", ".join(f"{n} ({c})" for n, c in dst_counts.items() if c)
        sys.exit(f"Target already has rows in: {busy}. Re-run with --replace to overwrite them.")

    started = time.time()
    copied: dict[str, int] = {}
    with source.connect() as reader, target.begin() as conn:
        # Rows go in exactly as they came out; checks resume when this ends.
        conn.execute(text("SET LOCAL session_replication_role = replica"))
        if args.replace:
            conn.execute(text("TRUNCATE " + ", ".join(f'"{t.name}"' for t in tables)))
        for table in tables:
            rows = [dict(r) for r in reader.execute(select(table)).mappings()]
            for i in range(0, len(rows), BATCH):
                conn.execute(table.insert(), rows[i:i + BATCH])
            copied[table.name] = len(rows)
            if rows:
                print(f"  {table.name:32} {len(rows):6d}")

    final = _counts(target, tables)
    bad = [n for n in src_counts if src_counts[n] != final[n]]
    print(f"\ncopied {sum(copied.values())} rows in {time.time() - started:.0f}s")
    if bad:
        sys.exit("row counts differ after the copy: " + ", ".join(bad))
    print("row counts match. Remove SOURCE_DATABASE_URL from backend/.env when you are done.")


if __name__ == "__main__":
    main()
