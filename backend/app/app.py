from flask import Flask, jsonify
from .routes_health import bp_health
from .routes_tournaments import bp_tournaments
from .routes_players import bp_players

def create_app():
    app = Flask(__name__)

    app.register_blueprint(bp_health)
    app.register_blueprint(bp_tournaments)
    app.register_blueprint(bp_players)

    @app.errorhandler(Exception)
    def handle_error(e):
        return jsonify({"ok": False, "error": str(e)}), 500

    return app

app = create_app()
