from flask import Blueprint, request, jsonify
from app.db.db import execute_returning_one

bp_players = Blueprint("players", __name__)

@bp_players.post("/players/upsert")
def upsert_player():
    data = request.get_json(silent=True) or {}

    tg_user_id = data.get("tg_user_id")
    if not tg_user_id:
        return jsonify({"ok": False, "error": "tg_user_id is required"}), 400

    row = execute_returning_one(
        """
        INSERT INTO users (tg_user_id, username, first_name, last_name, language_code, photo_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (tg_user_id) DO UPDATE SET
            username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            language_code = EXCLUDED.language_code,
            photo_url = EXCLUDED.photo_url,
            updated_at = NOW()
        RETURNING
            id, tg_user_id, username, first_name, last_name, language_code, photo_url,
            points, points_tour, created_at, updated_at;
        """,
        (
            tg_user_id,
            data.get("username"),
            data.get("first_name"),
            data.get("last_name"),
            data.get("language_code"),
            data.get("photo_url"),
        ),
    )

    return jsonify({"ok": True, "player": row}), 200
