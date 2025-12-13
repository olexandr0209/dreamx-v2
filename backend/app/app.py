from flask import Flask, jsonify
from .routes_health import bp_health
from .routes_users import bp_users
from .routes_tournaments import bp_tournaments

def create_app():
    app = Flask(__name__)

    app.register_blueprint(bp_health)
    app.register_blueprint(bp_users)
    app.register_blueprint(bp_tournaments)

    @app.errorhandler(Exception)
    def handle_error(e):
        # щоб фронт бачив JSON навіть при помилках
        return jsonify({"ok": False, "error": str(e)}), 500

    return app

app = create_app()
