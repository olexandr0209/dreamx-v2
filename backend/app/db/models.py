# backend/app/db/models.py
from app.db.db import execute_returning_one

def upsert_user_from_tg(
    tg_user_id: int,
    username: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    language_code: str | None = None,
    photo_url: str | None = None,
):
    return execute_returning_one(
        """
        INSERT INTO users (tg_user_id, username, first_name, last_name, language_code, photo_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (tg_user_id) DO UPDATE SET
            username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            language_code = EXCLUDED.language_code,
            photo_url = EXCLUDED.photo_url
        RETURNING *;
        """,
        (tg_user_id, username, first_name, last_name, language_code, photo_url),
    )

