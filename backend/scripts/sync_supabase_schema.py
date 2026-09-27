"""Bring a Postgres database up to the schema the code expects.

    cd backend
    .venv\\Scripts\\python scripts\\sync_supabase_schema.py --check   # report only
    .venv\\Scripts\\python scripts\\sync_supabase_schema.py           # apply

SQLAlchemy's create_all() adds missing *tables* but never adds a column to a
table that already exists, so a database that has been live through a few
releases drifts from models.py. This compares the two and closes the gap.

It only ever adds. It does not drop a table, drop a column, or change a type,
so it cannot lose data — a column the code no longer uses is left alone and
reported. Anything beyond adding is left for a human to decide.
"""
from __future__ import annotations

import argparse
import os
import sys
import warnings
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import SAWarning

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")
from app.models import Base  # noqa: E402

# Postgres spellings for the column types models.py uses.
SQL_TYPE = {
    "VARCHAR": "VARCHAR", "TEXT": "TEXT", "INTEGER": "INTEGER", "BIGINT": "BIGINT",
    "FLOAT": "DOUBLE PRECISION", "BOOLEAN": "BOOLEAN", "DATETIME": "TIMESTAMP",
    "DATE": "DATE", "JSON": "JSONB",
}


def _column_sql(column) -> str:
    name = type(column.type).__name__.upper()
    ddl = SQL_TYPE.get(name)
    if ddl is None:
        ddl = str(column.type.compile()) if hasattr(column.type, "compile") else "TEXT"
    return f'ADD COLUMN IF NOT EXISTS "{column.name}" {ddl}'


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report the gap without changing anything")
    args = ap.parse_args()

    url = os.getenv("DATABASE_URL", "")
    if not url.startswith("postgres"):
        sys.exit("DATABASE_URL in backend/.env is not a Postgres database")
    engine = create_engine(url, connect_args={"connect_timeout": 30})
    print("database:", engine.url.host)

    with warnings.catch_warnings():
        # Some tables reference each other; the order does not matter here.
        warnings.simplefilter("ignore", SAWarning)
        tables = list(Base.metadata.sorted_tables)

    insp = inspect(engine)
    live = set(insp.get_table_names())
    missing_tables = [t for t in tables if t.name not in live]
    missing_columns: list[tuple[str, object]] = []
    for table in tables:
        if table.name not in live:
            continue
        have = {c["name"] for c in insp.get_columns(table.name)}
        missing_columns += [(table.name, c) for c in table.columns if c.name not in have]

    print(f"tables: code {len(tables)}, database {len(live)}")
    print("missing tables :", [t.name for t in missing_tables] or "none")
    print("missing columns:", [f"{t}.{c.name}" for t, c in missing_columns] or "none")

    extra = sorted(live - {t.name for t in tables})
    if extra:
        print("in the database but not in the code (left alone):", extra)

    if args.check:
        return
    if not missing_tables and not missing_columns:
        print("\nnothing to do")
        return

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", SAWarning)
        Base.metadata.create_all(engine)
    if missing_tables:
        print("created:", [t.name for t in missing_tables])

    with engine.begin() as conn:
        for table_name, column in missing_columns:
            conn.execute(text(f'ALTER TABLE "{table_name}" {_column_sql(column)}'))
            print(f"added: {table_name}.{column.name}")

    insp = inspect(engine)
    live = set(insp.get_table_names())
    left = [t.name for t in tables if t.name not in live]
    for table in tables:
        if table.name in live:
            have = {c["name"] for c in insp.get_columns(table.name)}
            left += [f"{table.name}.{c.name}" for c in table.columns if c.name not in have]
    print("\nstill missing:", left or "nothing")


if __name__ == "__main__":
    main()
