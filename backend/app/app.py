# backend/app/app.py (або де твій entrypoint)

from flask import Flask, jsonify

from app.api.players import bp_players
from app.api.games import bp_games
from app.api.users import bp_users  # якщо є
from app.api.health import bp_health  # якщо є
from app.api.tournaments import bp_tournaments  # якщо є

def create_app():
    app = Flask(__name__)

    app.register_blueprint(bp_health)
    app.register_blueprint(bp_tournaments)
    app.register_blueprint(bp_players)
    app.register_blueprint(bp_users)
    app.register_blueprint(bp_games)

    @app.errorhandler(Exception)
    def handle_error(e):
        return jsonify({"ok": False, "error": str(e)}), 500

    return app

app = create_app()
