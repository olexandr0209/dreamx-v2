# backend/api/games.py
from flask import Blueprint, jsonify, request
from backend.db.db import execute

bp_games = Blueprint("games", __name__, url_prefix="/games")


def _get_tg_user_id():
    tg = request.headers.get("X-Tg-User-Id") or request.args.get("tg_user_id")
    if not tg:
        return None
    try:
        return int(tg)
    except:
        return None


@bp_games.post("/log")
def log_game():
    tg_user_id = _get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing tg_user_id"}), 400

    body = request.get_json(silent=True) or {}
    mode = body.get("mode", "bot_rps")
    user_move = body.get("user_move")
    bot_move = body.get("bot_move")
    result = body.get("result")  # win/lose/draw
    points_delta = body.get("points_delta", 0)

    execute(
        """
        INSERT INTO games (tg_user_id, mode, user_move, bot_move, result, points_delta)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (tg_user_id, mode, user_move, bot_move, result, points_delta),
    )

    return jsonify({"ok": True})
