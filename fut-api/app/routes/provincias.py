"""
app/routes/provincias.py — Endpoint opcional de provincias.

Endpoints en este archivo:
    GET /provincias -> lista de provincias (filtro opcional ?pais_id=)
"""

from flask import Blueprint, jsonify, request

from app.db import get_db

bp = Blueprint("provincias", __name__, url_prefix="/provincias")


@bp.route("", methods=["GET"])
def listar_provincias():
    """GET /provincias -> lista de provincias, con filtro opcional ?pais_id=<id>."""
    db = get_db()
    pais_id = request.args.get("pais_id")

    if pais_id is not None:
        filas = db.execute(
            "SELECT id, nombre, pais_id FROM provincias WHERE pais_id = ? ORDER BY nombre",
            (pais_id,),
        ).fetchall()
    else:
        filas = db.execute("SELECT id, nombre, pais_id FROM provincias ORDER BY nombre").fetchall()

    provincias = [dict(fila) for fila in filas]
    return jsonify(provincias), 200
