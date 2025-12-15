# backend/app/api/players.py

from flask import Blueprint, jsonify, request
from app.db.db import fetch_one, execute_returning_one, execute

bp_players = Blueprint("players", __name__, url_prefix="/players")


def _get_tg_user_id():
    """
    ЄДИНЕ ДЖЕРЕЛО ПРАВДИ:
    беремо tg_user_id або з header, або з query
    """
    tg = request.headers.get("X-Tg-User-Id") or request.args.get("tg_user_id")
    if not tg:
        return None
    try:
        return int(tg)
    except:
        return None


@bp_players.get("/me")
def me():
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing_tg_user_id"}), 400

    user = fetch_one(
        """
        SELECT id, tg_user_id, username, first_name, last_name, language_code,
               photo_url, points, points_tour, created_at, updated_at
        FROM users
        WHERE tg_user_id = %s
        """,
        (tg_user_id,)
    )

    if not user:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    return jsonify({"ok": True, "user": user})


@bp_players.post("/upsert")
def upsert():
    body = request.get_json(silent=True) or {}

    tg_user_id = body.get("tg_user_id")
    if tg_user_id is None:
        return jsonify({"ok": False, "error": "missing tg_user_id"}), 400

    try:
        tg_user_id = int(tg_user_id)
    except:
        return jsonify({"ok": False, "error": "tg_user_id must be int"}), 400

    user = execute_returning_one(
        """
        INSERT INTO users (tg_user_id, username, first_name, last_name, language_code, photo_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (tg_user_id) DO UPDATE
        SET username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            language_code = EXCLUDED.language_code,
            photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
            updated_at = NOW()
        RETURNING id, tg_user_id, username, first_name, last_name,
                  language_code, photo_url, points, points_tour,
                  created_at, updated_at
        """,
        (
            tg_user_id,
            body.get("username"),
            body.get("first_name"),
            body.get("last_name"),
            body.get("language_code"),
            body.get("photo_url"),
        ),
    )

    return jsonify({"ok": True, "user": user})
