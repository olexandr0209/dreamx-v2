from flask import Blueprint, request, jsonify
import random

from app.db.db import fetch_one, execute  # під твою db.py

bp_games = Blueprint("games", __name__, url_prefix="/games")

MOVES = ("rock", "paper", "scissors")

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
    data = request.get_json(silent=True) or {}
    tg_user_id = data.get("tg_user_id")
    user_move = data.get("move")

    if not tg_user_id or user_move not in MOVES:
        return jsonify({"ok": False, "error": "bad_request"}), 400

    user = fetch_one("SELECT id, points FROM users WHERE tg_user_id=%s", (tg_user_id,))
    if not user:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    bot_move = random.choice(MOVES)
    result = decide(user_move, bot_move)

    # Очки: можна змінити пізніше. Зараз: win=+1, draw=0, lose=0
    points_delta = 1 if result == "win" else 0

    execute("UPDATE users SET points = points + %s WHERE id=%s", (points_delta, user["id"]))
    execute(
        """
        INSERT INTO bot_games(user_id, user_move, bot_move, result, points_delta)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user["id"], user_move, bot_move, result, points_delta)
    )

    stats = fetch_one(
        """
        SELECT
          COUNT(*)::int AS games_total,
          COALESCE(SUM(CASE WHEN result='win' THEN 1 ELSE 0 END),0)::int AS wins_total
        FROM bot_games
        WHERE user_id=%s
        """,
        (user["id"],)
    )

    new_points = fetch_one("SELECT points FROM users WHERE id=%s", (user["id"],))["points"]

    return jsonify({
        "ok": True,
        "bot_move": bot_move,
        "result": result,
        "points_delta": points_delta,
        "points": new_points,
        "games_total": stats["games_total"],
        "wins_total": stats["wins_total"],
    })
