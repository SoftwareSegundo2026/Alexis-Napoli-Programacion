"""
app/routes/web.py — Sirve la mini web de consulta 
"""

from flask import Blueprint, render_template

bp = Blueprint("web", __name__)


@bp.route("/", methods=["GET"])
def index():
    return render_template("index.html")
