from flask import Blueprint, request, jsonify
from .config import APP_USE_DB
from .db import fetch_one

bp_users = Blueprint("users", __name__)

@bp_users.post("/api/users/upsert")
def upsert_user():
    data = request.get_json(force=True) or {}

    telegram_id = data.get("telegram_id")
    username = data.get("username")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    language_code = data.get("language_code")

    if not telegram_id:
        return jsonify({"ok": False, "error": "telegram_id is required"}), 400

    if not APP_USE_DB:
        # тимчасовий режим без БД (щоб WebApp не впав)
        return jsonify({
            "ok": True,
            "user": {
                "id": 1,
                "telegram_id": int(telegram_id),
                "username": username,
                "first_name": first_name
            },
            "note": "DB disabled; returned mock user"
        })

    row = fetch_one(
        """
        INSERT INTO users (telegram_id, username, first_name, last_name, language_code, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (telegram_id)
        DO UPDATE SET
            username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            language_code = EXCLUDED.language_code,
            updated_at = NOW()
        RETURNING id, telegram_id, username, first_name, last_name, language_code, created_at, updated_at;
        """,
        (telegram_id, username, first_name, last_name, language_code),
    )

    return jsonify({"ok": True, "user": row})
