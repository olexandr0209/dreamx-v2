# backend/api/players.py
from flask import Blueprint, jsonify, request
from backend.db.db import fetch_one, execute_returning_one, execute

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
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing tg_user_id"}), 400

    row = fetch_one(
        """
        SELECT id, tg_user_id, username, first_name, last_name, language_code,
               photo_url, points, points_tour, created_at, updated_at
        FROM users
        WHERE tg_user_id = %s
        """,
        (tg_user_id,),
    )

    if not row:
        return jsonify({"ok": False, "error": "user not found"}), 404

    return jsonify({"ok": True, "user": row})


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

