# backend/app/api/games.py
from flask import Blueprint, request, jsonify
import random

from app.db.db import fetch_one, execute, execute_returning_one

bp_games = Blueprint("games", __name__, url_prefix="/games")

MOVES = ("rock", "paper", "scissors")

def _get_tg_user_id():
    tg = request.headers.get("X-Tg-User-Id") or request.args.get("tg_user_id")
    if not tg:
        return None
    try:
        return int(tg)
    except:
        return None

def decide(user_move: str, bot_move: str) -> str:
    if user_move == bot_move:
        return "draw"
    if (
        (user_move == "rock" and bot_move == "scissors") or
        (user_move == "scissors" and bot_move == "paper") or
        (user_move == "paper" and bot_move == "rock")
    ):
        return "win"
    return "lose"

@bp_games.post("/bot/play")
def bot_play():
    tg_user_id = _get_tg_user_id()
    data = request.get_json(silent=True) or {}
    user_move = data.get("move")

    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing_tg_user_id"}), 400
    if user_move not in MOVES:
        return jsonify({"ok": False, "error": "bad_move"}), 400

    user = fetch_one("SELECT id, points FROM users WHERE tg_user_id=%s", (tg_user_id,))
    if not user:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    bot_move = random.choice(MOVES)
    result = decide(user_move, bot_move)

    # очки: win +1, draw 0, lose 0 (або зроби lose -1 якщо хочеш)
    points_delta = 1 if result == "win" else 0

    row = execute_returning_one(
        """
        UPDATE users
        SET points = points + %s,
            updated_at = NOW()
        WHERE id = %s
        RETURNING points
        """,
        (points_delta, user["id"])
    )

    execute(
        """
        INSERT INTO bot_games(user_id, mode, user_move, bot_move, result, points_delta)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (user["id"], "bot_rps", user_move, bot_move, result, points_delta)
    )

    return jsonify({
        "ok": True,
        "user_move": user_move,
        "bot_move": bot_move,
        "result": result,
        "points_delta": points_delta,
        "points": row["points"],
    })
