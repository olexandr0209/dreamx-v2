# backend/app/routes_users.py

from flask import Blueprint, jsonify
from app.core.tg_user import get_tg_user_id
from app.db.db import fetch_one

bp_users = Blueprint("users", __name__, url_prefix="/users")


@bp_users.get("/me")
def me():
    tg_user_id = get_tg_user_id()
    if not tg_user_id:
        return jsonify({"ok": False, "error": "missing_tg_user_id"}), 400

    user = fetch_one(
        """
        SELECT id, tg_user_id, username, first_name, last_name, language_code,
               photo_url, points, points_tour, created_at, updated_at
        FROM users
        WHERE tg_user_id = %s
        """,
        (tg_user_id,),
    )

    if not user:
        return jsonify({"ok": False, "error": "user_not_found"}), 404

    return jsonify({"ok": True, "user": user})


@bp_users.get("/ping")
def ping():
    return jsonify({"ok": True, "module": "users"})
