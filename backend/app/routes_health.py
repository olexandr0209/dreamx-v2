from flask import Blueprint, jsonify

bp_health = Blueprint("health", __name__)

@bp_health.route("/")
@bp_health.route("/health")
def health():
    return jsonify({"ok": True, "service": "dreamx-v2"})
