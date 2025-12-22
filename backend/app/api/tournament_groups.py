# backend/app/api/tournament_groups.py

from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services.tournament_groups_service import (
    join_tournament,
    leave_tournament,
    get_state_for_user,
    submit_move,
    tick_tournament,
)

bp_tg = Blueprint("tournament_groups", __name__, url_prefix="/tg")


def _int(v, name: str) -> int:
    try:
        return int(v)
    except Exception:
        raise ValueError(f"bad_{name}")


@bp_tg.post("/join")
def tg_join():
    payload = request.get_json(silent=True) or {}
    try:
        tournament_id = _int(payload.get("tournament_id"), "tournament_id")
        tg_user_id = _int(payload.get("tg_user_id"), "tg_user_id")
        join_code = payload.get("join_code")
        res = join_tournament(tournament_id, tg_user_id, join_code)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    if not res.get("ok") and res.get("error") == "tournament_not_found":
        return jsonify(res), 404
    return jsonify(res), (200 if res.get("ok") else 400)


@bp_tg.post("/leave")
def tg_leave():
    payload = request.get_json(silent=True) or {}
    try:
        tournament_id = _int(payload.get("tournament_id"), "tournament_id")
        tg_user_id = _int(payload.get("tg_user_id"), "tg_user_id")
        res = leave_tournament(tournament_id, tg_user_id)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify(res), (200 if res.get("ok") else 400)


@bp_tg.get("/state")
def tg_state():
    # GET /tg/state?tournament_id=1&tg_user_id=123
    try:
        tournament_id = _int(request.args.get("tournament_id"), "tournament_id")
        tg_user_id = _int(request.args.get("tg_user_id"), "tg_user_id")
        res = get_state_for_user(tournament_id, tg_user_id)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    if not res.get("ok") and res.get("error") == "tournament_not_found":
        return jsonify(res), 404
    return jsonify(res), (200 if res.get("ok") else 400)


@bp_tg.post("/move")
def tg_move():
    payload = request.get_json(silent=True) or {}
    try:
        tournament_id = _int(payload.get("tournament_id"), "tournament_id")
        tg_user_id = _int(payload.get("tg_user_id"), "tg_user_id")
        match_id = _int(payload.get("match_id"), "match_id")
        move = (payload.get("move") or "").strip()
        res = submit_move(tournament_id, tg_user_id, match_id, move)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify(res), (200 if res.get("ok") else 400)


@bp_tg.post("/tick")
def tg_tick():
    payload = request.get_json(silent=True) or {}
    try:
        tournament_id = _int(payload.get("tournament_id"), "tournament_id")
        res = tick_tournament(tournament_id)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    if not res.get("ok") and res.get("error") == "tournament_not_found":
        return jsonify(res), 404
    return jsonify(res), (200 if res.get("ok") else 400)
