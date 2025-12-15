# backend/app/app.py

from flask import Flask, jsonify
from flask_cors import CORS

from app.api.players import bp_players
from app.api.games import bp_games
from app.routes_health import bp_health
from app.routes_tournaments import bp_tournaments


def create_app():
    app = Flask(__name__)

    # ✅ CORS: дозволяємо WebApp звертатись до API з іншого домену
    CORS(
        app,
        resources={r"/*": {"origins": "*"}},
        supports_credentials=False,
        allow_headers=["Content-Type", "X-Tg-User-Id"],
        methods=["GET", "POST", "OPTIONS"],
    )

    app.register_blueprint(bp_health)
    app.register_blueprint(bp_tournaments)
    app.register_blueprint(bp_players)
    app.register_blueprint(bp_games)

    @app.errorhandler(Exception)
    def handle_error(e):
        return jsonify({"ok": False, "error": str(e)}), 500

    return app


app = create_app()
