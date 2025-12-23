# backend/app/routes_users.py

from flask import Blueprint, jsonify, request
from app.db.db import execute_returning_one

bp_users = Blueprint("users", __name__, url_prefix="/users")


@bp_users.get("/me")
def me():
    """
    Заглушка профілю користувача (поки без БД).
    Потім сюди підключимо Telegram initData / user_id і збереження в БД.
    """
    # На майбутнє (Telegram WebApp): можна буде приймати user_id з заголовка або query
    # user_id = request.headers.get("X-User-Id") or request.args.get("user_id")

    return jsonify({
        "ok": True,
        "user": {
            "id": 1,
            "username": "test_user",
            "first_name": "Test",
            "points": 0
        }
    })


@bp_users.get("/ping")
def ping():
    return jsonify({"ok": True, "module": "users"})
