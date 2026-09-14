from flask import Blueprint

bp = Blueprint("main", __name__)

@bp.route("/")
def index():
    return {
        "status": "ok",
        "message": "Server is running!"
    }
