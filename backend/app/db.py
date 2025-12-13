import os
import psycopg2
from psycopg2.extras import RealDictCursor
from .config import DATABASE_URL, APP_USE_DB

def get_conn():
    if not APP_USE_DB:
        raise RuntimeError("DB disabled (APP_USE_DB=0)")
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is missing")
    sslmode = os.getenv("PG_SSLMODE", "require")
    return psycopg2.connect(DATABASE_URL, sslmode=sslmode)

def fetch_one(sql: str, params=()):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone()

def fetch_all(sql: str, params=()):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchall()

def execute(sql: str, params=()):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
