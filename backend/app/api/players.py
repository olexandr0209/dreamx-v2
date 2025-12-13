# backend/api/players.py
from flask import Blueprint, jsonify, request
from ..db.db import fetch_one, execute_returning_one, execute

bp_players = Blueprint("players", __name__, url_prefix="/players")


def _get_tg_user_id():
    # беремо з заголовка або з query
    tg = request.headers.get("X-Tg-User-Id") or request.args.get("tg_user_id")
    if not tg:
        return None
    try:
        return int(tg)
    except:
        return None


@bp_players.get("/me")
def me():
    tg_user_id = request.args.get("tg_user_id", type=int)
    if not tg_user_id:
        return jsonify({"ok": False, "error": "bad_request"}), 400

    user = fetch_one(
        """
        SELECT id, tg_user_id, username, first_name, last_name, language_code, photo_url,
               points, points_tour, created_at, updated_at
        FROM users
        WHERE tg_user_id=%s
        """,
        (tg_user_id,)
    )
    if not user:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    return jsonify({"ok": True, "user": user})

@bp_players.post("/add_points")
def add_points():
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing tg_user_id"}), 400

    body = request.get_json(silent=True) or {}
    delta = body.get("delta")

    if delta is None:
        return jsonify({"ok": False, "error": "missing delta"}), 400

    try:
        delta = int(delta)
    except:
        return jsonify({"ok": False, "error": "delta must be int"}), 400

    row = execute_returning_one(
        """
        UPDATE users
        SET points = points + %s,
            updated_at = NOW()
        WHERE tg_user_id = %s
        RETURNING points
        """,
        (delta, tg_user_id),
    )

    if not row:
        return jsonify({"ok": False, "error": "user not found"}), 404

    return jsonify({"ok": True, "points": row["points"]})


@bp_players.post("/set_photo_url")
def set_photo_url():
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing tg_user_id"}), 400

    body = request.get_json(silent=True) or {}
    photo_url = body.get("photo_url")

    execute(
        """
        UPDATE users
        SET photo_url = %s,
            updated_at = NOW()
        WHERE tg_user_id = %s
        """,
        (photo_url, tg_user_id),
    )
    return jsonify({"ok": True})

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

    username = body.get("username")
    first_name = body.get("first_name")
    last_name = body.get("last_name")
    language_code = body.get("language_code")
    photo_url = body.get("photo_url")  # може бути None

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
        RETURNING id, tg_user_id, username, first_name, last_name, language_code, photo_url,
                  points, points_tour, created_at, updated_at
        """,
        (tg_user_id, username, first_name, last_name, language_code, photo_url),
    )

    return jsonify({"ok": True, "user": user})

