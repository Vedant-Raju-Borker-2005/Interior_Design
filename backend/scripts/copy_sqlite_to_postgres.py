"""Copy the local SQLite database into the Postgres database named by DATABASE_URL.

    cd backend
    .venv\\Scripts\\python scripts\\copy_sqlite_to_postgres.py            # empty target only
    .venv\\Scripts\\python scripts\\copy_sqlite_to_postgres.py --replace  # overwrite target rows

Creates any missing tables from the models, then copies every row of every
table in one transaction, so a failure leaves the target unchanged. The local
SQLite file is only read. Row counts are compared at the end.
"""
from __future__ import annotations

import argparse
import datetime
import json
import sqlite3
import sys
import warnings
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, create_engine, func, select, text
from sqlalchemy.exc import SAWarning

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.models import Base  # noqa: E402


def convert(column, value):
    """SQLite stores most values as text; give Postgres the column's real type."""
    if value is None:
        return None
    kind = column.type
    if isinstance(value, str):
        value = value.replace("\x00", "")            # Postgres text cannot hold NUL
    if isinstance(kind, JSON):
        if isinstance(value, (str, bytes)):
            try:
                return json.loads(value)
            except ValueError:
                return value                          # a bare string is still valid JSON
        return value
    if isinstance(kind, DateTime):
        if isinstance(value, str):
            value = value.strip()
            return datetime.datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None
        return value
    if isinstance(kind, Boolean):
        if isinstance(value, str):
            return value.strip().lower() in ("1", "true", "t", "yes")
        return bool(value)
    if isinstance(kind, Integer):
        if isinstance(value, str):
            value = value.strip()
            return int(float(value)) if value else None
        return int(value) if isinstance(value, float) and value.is_integer() else value
    if isinstance(kind, Float):
        if isinstance(value, str):
            value = value.strip()
            return float(value) if value else None
        return value
    if isinstance(kind, String) and not isinstance(value, str):
        return str(value)
    return value


def number_quotations(rows: list[dict]) -> list[tuple]:
    """Quotation numbers are unique in Postgres (feedback 1.4). Older SQLite rows
    could share a legacy number or have none: the earliest keeps its number and
    the rest get the next free QT-LEGACY one."""
    tail = lambda no: no.rsplit("-", 1)[1]
    used = [int(tail(r["quotation_no"])) for r in rows
            if (r.get("quotation_no") or "").startswith("QT-LEGACY-") and tail(r["quotation_no"]).isdigit()]
    nxt = max(used, default=0) + 1
    seen, changed = set(), []
    for r in sorted(rows, key=lambda r: r.get("created_at") or datetime.datetime.min):
        no = r.get("quotation_no")
        if no and no not in seen:
            seen.add(no)
            continue
        r["quotation_no"] = f"QT-LEGACY-{nxt:05d}"
        nxt += 1
        seen.add(r["quotation_no"])
        changed.append((r["id"], no, r["quotation_no"]))
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sqlite", default=str(BACKEND / "interior_ai.db"), help="source SQLite file")
    parser.add_argument("--replace", action="store_true", help="empty the target tables first")
    args = parser.parse_args()

    url = dotenv_values(BACKEND / ".env").get("DATABASE_URL") or ""
    if not url.startswith("postgres"):
        sys.exit("backend/.env has no Postgres DATABASE_URL")
    source = sqlite3.connect(args.sqlite)
    target = create_engine(url)
    with warnings.catch_warnings():
        # flats / floor_plans / projects reference each other; with foreign-key
        # checks paused for the copy, their order does not matter.
        warnings.simplefilter("ignore", SAWarning)
        tables = Base.metadata.sorted_tables

    Base.metadata.create_all(target)
    with target.connect() as conn:
        filled = {t.name: conn.execute(select(func.count()).select_from(t)).scalar() for t in tables}
    if any(filled.values()) and not args.replace:
        busy = ", ".join(f"{name} ({n})" for name, n in filled.items() if n)
        sys.exit(f"Target already has rows in: {busy}. Re-run with --replace to overwrite them.")

    copied: dict[str, int] = {}
    with target.begin() as conn:
        # Rows go in exactly as they are in SQLite, which never enforced its
        # foreign keys; checks resume when this transaction ends.
        conn.execute(text("SET LOCAL session_replication_role = replica"))
        if args.replace:
            names = ", ".join(f'"{t.name}"' for t in tables)
            conn.execute(text(f"TRUNCATE {names}"))
        for table in tables:
            present = {row[1] for row in source.execute(f'PRAGMA table_info("{table.name}")')}
            columns = [c for c in table.columns if c.name in present]
            if not columns:
                copied[table.name] = 0
                continue
            names = ", ".join(f'"{c.name}"' for c in columns)
            rows = []
            for raw in source.execute(f'SELECT {names} FROM "{table.name}"'):
                try:
                    rows.append({c.name: convert(c, v) for c, v in zip(columns, raw)})
                except ValueError as err:
                    sys.exit(f"{table.name}: could not convert a row ({err}); nothing was copied")
            if table.name == "quotations":
                for qid, old, new in number_quotations(rows):
                    print(f"  quotation {qid}: {old or 'no number'} -> {new}")
            if rows:
                conn.execute(table.insert(), rows)
            copied[table.name] = len(rows)

    with target.connect() as conn:
        mismatched = []
        for table in tables:
            n = conn.execute(select(func.count()).select_from(table)).scalar()
            if n != copied[table.name]:
                mismatched.append(f"{table.name}: copied {copied[table.name]}, found {n}")
    print(f"Copied {sum(copied.values())} rows across {len(tables)} tables.")
    for name, n in sorted(copied.items(), key=lambda kv: -kv[1]):
        if n:
            print(f"  {name:<34}{n:>6}")
    if mismatched:
        sys.exit("Row counts differ:\n  " + "\n  ".join(mismatched))
    print("Row counts match.")


if __name__ == "__main__":
    main()
