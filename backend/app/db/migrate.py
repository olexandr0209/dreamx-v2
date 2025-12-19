# migrate.py

import os
import sys
from pathlib import Path

from app.db.connection import get_conn

SCHEMA_DIR = Path(__file__).parent / "schema"

def _ensure_schema_migrations_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            filename TEXT PRIMARY KEY,
            applied_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
    """)

def _already_applied(cur) -> set[str]:
    cur.execute("SELECT filename FROM schema_migrations;")
    return {row["filename"] for row in cur.fetchall()}


def _apply_file(cur, filename: str, sql_text: str):
    cur.execute(sql_text)
    cur.execute("INSERT INTO schema_migrations(filename) VALUES (%s);", (filename,))

def run_migrations():
    if not SCHEMA_DIR.exists():
        raise RuntimeError(f"Schema directory not found: {SCHEMA_DIR}")

    sql_files = sorted([p for p in SCHEMA_DIR.glob("*.sql")])
    if not sql_files:
        raise RuntimeError(f"No .sql files found in: {SCHEMA_DIR}")

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                _ensure_schema_migrations_table(cur)
                applied = _already_applied(cur)

                for path in sql_files:
                    fname = path.name
                    if fname in applied:
                        continue

                    sql_text = path.read_text(encoding="utf-8")
                    print(f"[MIGRATE] applying {fname} ...")
                    _apply_file(cur, fname, sql_text)
                    print(f"[MIGRATE] applied {fname}")

        print("[MIGRATE] ✅ done")
    finally:
        conn.close()

if __name__ == "__main__":
    try:
        run_migrations()
    except Exception as e:
        print(f"[MIGRATE] ❌ error: {e}")
        sys.exit(1)
