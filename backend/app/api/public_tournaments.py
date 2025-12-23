# backend/app/api/public_tournaments.py

from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services.tournament_groups_service import (
    get_state_for_user,
    join_tournament,
    leave_tournament,
    submit_move,
)

bp_public = Blueprint("public_tournaments", __name__, url_prefix="/api/public")


def _get_debug_tg_user_id() -> int:
    """
    DEV-only auth for public endpoints.
    Frontend must send header: X-Debug-Tg-User-Id: <int>
    PROD auth (Telegram initData validation) will be done in Step 4.
    """
    raw = request.headers.get("X-Debug-Tg-User-Id", "").strip()
    if not raw:
        raise ValueError("missing_tg_user_id")
    try:
        return int(raw)
    except Exception:
        raise ValueError("bad_tg_user_id")


@bp_public.get("/tournaments/<int:tournament_id>/state")
def public_tournament_state(tournament_id: int):
    try:
        tg_user_id = _get_debug_tg_user_id()
        data = get_state_for_user(tournament_id, tg_user_id)
        return jsonify(data)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@bp_public.post("/tournaments/<int:tournament_id>/join")
def public_tournament_join(tournament_id: int):
    try:
        tg_user_id = _get_debug_tg_user_id()
        res = join_tournament(tournament_id, tg_user_id, join_code=None)
        return jsonify(res)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@bp_public.post("/tournaments/<int:tournament_id>/leave")
def public_tournament_leave(tournament_id: int):
    try:
        tg_user_id = _get_debug_tg_user_id()
        res = leave_tournament(tournament_id, tg_user_id)
        return jsonify(res)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@bp_public.post("/matches/<int:match_id>/move")
def public_match_move(match_id: int):
    """
    Body JSON:
      {
        "tournament_id": 123,
        "move": "rock" | "paper" | "scissors"
      }
    """
    try:
        tg_user_id = _get_debug_tg_user_id()
        payload = request.get_json(silent=True) or {}

        tournament_id = int(payload.get("tournament_id") or 0)
        move = (payload.get("move") or "").strip()

        if tournament_id <= 0:
            return jsonify({"ok": False, "error": "missing_tournament_id"}), 400
        if not move:
            return jsonify({"ok": False, "error": "missing_move"}), 400

        res = submit_move(tournament_id, tg_user_id, match_id, move)
        return jsonify(res)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
