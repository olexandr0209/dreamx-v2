# backend/app/api/tournament_groups.py

from flask import Blueprint, request, jsonify

from app.services.tournament_groups_service import (
    join_tournament, leave_tournament, get_state_for_user, submit_move
)

bp_tg = Blueprint("tg", __name__, url_prefix="/tg")


def _as_int(v):
    try:
        return int(v)
    except Exception:
        return None


# ✅ NEW: універсально дістаємо параметри з JSON / form / query
def _get_param(name: str, default=None):
    data = request.get_json(silent=True) or {}
    if name in data and data[name] is not None:
        return data[name]
    v = request.form.get(name)
    if v is not None:
        return v
    v = request.args.get(name)
    if v is not None:
        return v
    return default


def _get_tg_user_id():
    tg = request.headers.get("X-Tg-User-Id") or _get_param("tg_user_id")
    return _as_int(tg)


def _get_tournament_id():
    tid = _get_param("tournament_id")
    return _as_int(tid)


@bp_tg.post("/join")
def api_join():
    tg_user_id = _get_tg_user_id()
    tournament_id = _get_tournament_id()
    if not tg_user_id or not tournament_id:
        return jsonify({"ok": False, "error": "missing_params"}), 400

    code = (_get_param("join_code") or "").strip() or None
    res = join_tournament(tournament_id, tg_user_id, code)
    code_http = 200 if res.get("ok") else 400
    return jsonify(res), code_http


@bp_tg.post("/leave")
def api_leave():
    tg_user_id = _get_tg_user_id()
    tournament_id = _get_tournament_id()
    if not tg_user_id or not tournament_id:
        return jsonify({"ok": False, "error": "missing_params"}), 400
    res = leave_tournament(tournament_id, tg_user_id)
    code_http = 200 if res.get("ok") else 400
    return jsonify(res), code_http


@bp_tg.get("/state")
def api_state():
    tg_user_id = _get_tg_user_id()
    tournament_id = _get_tournament_id()
    if not tg_user_id or not tournament_id:
        return jsonify({"ok": False, "error": "missing_params"}), 400
    return jsonify(get_state_for_user(tournament_id, tg_user_id))


@bp_tg.post("/move")
def api_move():
    tg_user_id = _get_tg_user_id()
    tournament_id = _get_tournament_id()
    match_id = _as_int(_get_param("match_id"))
    move = (_get_param("move") or "").strip()

    if not tg_user_id or not tournament_id or not match_id or not move:
        return jsonify({"ok": False, "error": "missing_params"}), 400

    # ✅ NEW (safe): базова валідація, щоб не летіло в сервіс
    if move not in ("rock", "paper", "scissors"):
        return jsonify({"ok": False, "error": "invalid_move"}), 400

    res = submit_move(tournament_id, tg_user_id, match_id, move)
    code_http = 200 if res.get("ok") else 400
    return jsonify(res), code_http
