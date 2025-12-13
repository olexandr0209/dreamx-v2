import os
import psycopg2

def get_conn():
    """
    Повертає підключення до Postgres.
    Очікує DATABASE_URL у env.
    На Render зазвичай потрібен sslmode=require.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise RuntimeError("DATABASE_URL is not set")

    sslmode = os.getenv("PG_SSLMODE", "require")
    return psycopg2.connect(db_url, sslmode=sslmode)

