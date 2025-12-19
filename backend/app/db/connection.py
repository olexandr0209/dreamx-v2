import os
import psycopg2
from psycopg2.extras import RealDictCursor

def get_conn():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")

    sslmode = os.getenv("PG_SSLMODE", "require")
    return psycopg2.connect(db_url, sslmode=sslmode, cursor_factory=RealDictCursor)
