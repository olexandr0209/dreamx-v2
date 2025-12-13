from flask import Blueprint, jsonify, request

from .db.storage import list_tournaments, get_tournament, create_tournament

bp_tournaments = Blueprint("tournaments", __name__, url_prefix="/tournaments")


@bp_tournaments.get("")
def tournaments_list():
    items = list_tournaments()
    return jsonify({"ok": True, "items": items})


@bp_tournaments.get("/<int:tournament_id>")
def tournaments_get(tournament_id: int):
    t = get_tournament(tournament_id)
    if not t:
        return jsonify({"ok": False, "error": "tournament not found"}), 404
    return jsonify({"ok": True, "item": t})


@bp_tournaments.post("")
def tournaments_create():
    payload = request.get_json(silent=True) or {}
    try:
        t = create_tournament(payload)
        return jsonify({"ok": True, "item": t}), 201
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
