from flask import Blueprint, request, jsonify
from .config import APP_USE_DB
from .db import fetch_all, fetch_one

bp_tournaments = Blueprint("tournaments", __name__)

@bp_tournaments.get("/api/tournaments")
def list_tournaments():
    status = request.args.get("status")

    if not APP_USE_DB:
        # мок-дані щоб фронт жив навіть без БД
        demo = [
            {"id": 1, "title": "DreamX Турнір #1", "status": "live", "host_username": "@Host", "start_at": None},
            {"id": 2, "title": "DreamX Турнір #2", "status": "upcoming", "host_username": "@Host", "start_at": None},
        ]
        if status:
            demo = [t for t in demo if t["status"] == status]
        return jsonify({"ok": True, "items": demo, "note": "DB disabled; returned mock tournaments"})

    if status:
        rows = fetch_all(
            """
            SELECT id, title, description, host_username, status, start_at, end_at, created_at
            FROM tournaments
            WHERE status=%s
            ORDER BY created_at DESC;
            """,
            (status,),
        )
    else:
        rows = fetch_all(
            """
            SELECT id, title, description, host_username, status, start_at, end_at, created_at
            FROM tournaments
            ORDER BY created_at DESC;
            """
        )

    return jsonify({"ok": True, "items": rows})


@bp_tournaments.get("/api/tournaments/<int:tournament_id>")
def get_tournament(tournament_id: int):
    if not APP_USE_DB:
        return jsonify({"ok": True, "item": {"id": tournament_id, "title": f"Demo #{tournament_id}", "status": "live"}})

    row = fetch_one(
        """
        SELECT id, title, description, host_username, status, start_at, end_at, created_at
        FROM tournaments
        WHERE id=%s;
        """,
        (tournament_id,),
    )
    if not row:
        return jsonify({"ok": False, "error": "tournament not found"}), 404
    return jsonify({"ok": True, "item": row})


@bp_tournaments.post("/api/tournaments/<int:tournament_id>/join")
def join_tournament(tournament_id: int):
    data = request.get_json(force=True) or {}
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "user_id is required"}), 400

    if not APP_USE_DB:
        return jsonify({"ok": True, "joined": True, "note": "DB disabled; join is mocked"})

    # перевір турніру
    t = fetch_one("SELECT id FROM tournaments WHERE id=%s;", (tournament_id,))
    if not t:
        return jsonify({"ok": False, "error": "tournament not found"}), 404

    # вставка без дублювання
    row = fetch_one(
        """
        INSERT INTO tournament_players (tournament_id, user_id, joined_at)
        VALUES (%s, %s, NOW())
        ON CONFLICT (tournament_id, user_id)
        DO NOTHING
        RETURNING id;
        """,
        (tournament_id, user_id),
    )

    return jsonify({"ok": True, "joined": True, "created": bool(row)})
