from flask import Blueprint, jsonify, request

bp_tournaments = Blueprint("tournaments", __name__, url_prefix="/tournaments")


@bp_tournaments.get("")
def list_tournaments():
    """
    Заглушка списку турнірів
    """
    return jsonify({
        "ok": True,
        "tournaments": [
            {
                "id": 1,
                "title": "BestGamers",
                "organizer": "@GamerBest",
                "status": "waiting",
                "players_count": 12,
                "starts_at": "2025-12-20T16:00:00Z"
            }
        ]
    })


@bp_tournaments.get("/<int:tournament_id>")
def get_tournament(tournament_id):
    """
    Заглушка одного турніру
    """
    return jsonify({
        "ok": True,
        "tournament": {
            "id": tournament_id,
            "title": "BestGamers",
            "organizer": "@GamerBest",
            "status": "waiting",
            "players_count": 12,
            "max_players": 50
        }
    })


@bp_tournaments.post("")
def create_tournament():
    """
    Заглушка створення турніру
    """
    data = request.json or {}

    return jsonify({
        "ok": True,
        "tournament": {
            "id": 99,
            "title": data.get("title", "New Tournament"),
            "max_players": data.get("max_players", 50),
            "chat_enabled": data.get("chat_enabled", False)
        }
    }), 201
