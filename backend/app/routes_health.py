from flask import Blueprint, jsonify
from .config import APP_ENV, APP_USE_DB

bp_health = Blueprint("health", __name__)

@bp_health.get("/health")
def health():
    return jsonify({"ok": True, "env": APP_ENV, "use_db": APP_USE_DB})
