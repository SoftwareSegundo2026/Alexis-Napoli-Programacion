"""
app/routes/ciudades.py — Endpoint opcional de ciudades.

Endpoints en este archivo:
    GET /ciudades -> lista de ciudades (filtro opcional ?provincia_id=)
"""

from flask import Blueprint, jsonify, request

from app.db import get_db

bp = Blueprint("ciudades", __name__, url_prefix="/ciudades")


@bp.route("", methods=["GET"])
def listar_ciudades():
    """GET /ciudades -> lista de ciudades, con filtro opcional ?provincia_id=<id>."""
    db = get_db()
    provincia_id = request.args.get("provincia_id")

    if provincia_id is not None:
        filas = db.execute(
            "SELECT id, nombre, provincia_id FROM ciudades WHERE provincia_id = ? ORDER BY nombre",
            (provincia_id,),
        ).fetchall()
    else:
        filas = db.execute("SELECT id, nombre, provincia_id FROM ciudades ORDER BY nombre").fetchall()

    ciudades = [dict(fila) for fila in filas]
    return jsonify(ciudades), 200
