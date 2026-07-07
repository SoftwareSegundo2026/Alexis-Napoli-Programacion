"""
app/routes/ligas.py — Endpoints de ligas.

Endpoints en este archivo:
    GET /ligas             -> lista todas las ligas (filtro opcional ?pais_id=)
    GET /ligas/<id>        -> una liga puntual, con sus torneos anidados
"""

from flask import Blueprint, jsonify, request

from app.db import get_db
from app.errors import ApiError

bp = Blueprint("ligas", __name__, url_prefix="/ligas")


@bp.route("", methods=["GET"])
def listar_ligas():
    """
    GET /ligas -> lista de ligas.
    Filtro opcional: ?pais_id=<id> para traer solo las ligas de un país.
    """
    db = get_db()
    pais_id = request.args.get("pais_id")

    if pais_id is not None:
        filas = db.execute(
            "SELECT id, nombre, pais_id, categoria, tipo FROM ligas WHERE pais_id = ? ORDER BY nombre",
            (pais_id,),
        ).fetchall()
    else:
        filas = db.execute(
            "SELECT id, nombre, pais_id, categoria, tipo FROM ligas ORDER BY nombre"
        ).fetchall()

    ligas = [dict(fila) for fila in filas]
    return jsonify(ligas), 200


@bp.route("/<int:liga_id>", methods=["GET"])
def obtener_liga(liga_id):
    """GET /ligas/<id> -> liga con su país (nombre resuelto) y sus torneos anidados."""
    db = get_db()

    fila_liga = db.execute(
        """SELECT
               ligas.id, ligas.nombre, ligas.categoria, ligas.tipo,
               paises.id AS pais_id, paises.nombre AS pais_nombre
           FROM ligas
           JOIN paises ON ligas.pais_id = paises.id
           WHERE ligas.id = ?""",
        (liga_id,),
    ).fetchone()

    if fila_liga is None:
        raise ApiError(f"Liga con id {liga_id} no encontrada", 404)

    liga = {
        "id": fila_liga["id"],
        "nombre": fila_liga["nombre"],
        "categoria": fila_liga["categoria"],
        "tipo": fila_liga["tipo"],
        "pais": {
            "id": fila_liga["pais_id"],
            "nombre": fila_liga["pais_nombre"],
        },
    }

    filas_torneos = db.execute(
        """SELECT id, nombre, temporada_id, fecha_inicio, fecha_fin
           FROM torneos
           WHERE liga_id = ?
           ORDER BY fecha_inicio DESC""",
        (liga_id,),
    ).fetchall()

    liga["torneos"] = [dict(fila) for fila in filas_torneos]

    return jsonify(liga), 200
