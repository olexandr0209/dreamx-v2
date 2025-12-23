# backend/app/api/public_tournaments.py

from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.services.tournament_groups_service import (
    get_state_for_user,
    join_tournament,
    leave_tournament,
    submit_move,
)

# ✅ NEW (мінімально)
from app.config import APP_ENV, TELEGRAM_BOT_TOKEN, TG_WEBAPP_MAX_AGE_SEC
from app.core.telegram_webapp import extract_user_id_from_init_data

bp_public = Blueprint("public_tournaments", __name__, url_prefix="/api/public")


HEADER_DEBUG_TG_USER_ID = "X-Debug-Tg-User-Id"
HEADER_TG_INIT_DATA = "X-Tg-Init-Data"


def _get_public_tg_user_id() -> int:
    """
    DEV:
      - header X-Debug-Tg-User-Id: <int>
    PROD:
      - header X-Tg-Init-Data: <Telegram.WebApp.initData> (validated)
    """
    # ---- DEV (як було) ----
    if APP_ENV != "prod":
        raw = (request.headers.get(HEADER_DEBUG_TG_USER_ID) or "").strip()
        if not raw:
            raise ValueError("missing_tg_user_id")
        try:
            return int(raw)
        except Exception:
            raise ValueError("bad_tg_user_id")

    # ---- PROD ----
    init_data = (request.headers.get(HEADER_TG_INIT_DATA) or "").strip()
    if not init_data:
        raise PermissionError("missing_init_data")

    uid = extract_user_id_from_init_data(
        init_data=init_data,
        bot_token=TELEGRAM_BOT_TOKEN,
        max_age_sec=TG_WEBAPP_MAX_AGE_SEC,
    )
    if not uid:
        raise PermissionError("bad_init_data")

    return int(uid)


@bp_public.get("/tournaments/<int:tournament_id>/state")
def public_tournament_state(tournament_id: int):
    try:
        tg_user_id = _get_public_tg_user_id()
        data = get_state_for_user(tournament_id, tg_user_id)
        return jsonify(data)
    except PermissionError as e:
        return jsonify({"ok": False, "error": str(e)}), 401
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@bp_public.post("/tournaments/<int:tournament_id>/join")
def public_tournament_join(tournament_id: int):
    try:
        tg_user_id = _get_public_tg_user_id()
        res = join_tournament(tournament_id, tg_user_id, join_code=None)
        return jsonify(res)
    except PermissionError as e:
        return jsonify({"ok": False, "error": str(e)}), 401
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@bp_public.post("/tournaments/<int:tournament_id>/leave")
def public_tournament_leave(tournament_id: int):
    try:
        tg_user_id = _get_public_tg_user_id()
        res = leave_tournament(tournament_id, tg_user_id)
        return jsonify(res)
    except PermissionError as e:
        return jsonify({"ok": False, "error": str(e)}), 401
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
        tg_user_id = _get_public_tg_user_id()
        payload = request.get_json(silent=True) or {}

        tournament_id = int(payload.get("tournament_id") or 0)
        move = (payload.get("move") or "").strip()

        if tournament_id <= 0:
            return jsonify({"ok": False, "error": "missing_tournament_id"}), 400
        if not move:
            return jsonify({"ok": False, "error": "missing_move"}), 400

        res = submit_move(tournament_id, tg_user_id, match_id, move)
        return jsonify(res)
    except PermissionError as e:
        return jsonify({"ok": False, "error": str(e)}), 401
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400
