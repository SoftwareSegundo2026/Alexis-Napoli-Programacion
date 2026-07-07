"""
app/routes/paises.py — Endpoints de países.

Endpoints:
    GET /paises           -> lista todos los países
    GET /paises/<id>      -> un país puntual, con sus provincias anidadas
"""

from flask import Blueprint, jsonify

from app.db import get_db
from app.errors import ApiError

# 'paises' es el nombre del blueprint (interno, para Flask).
# url_prefix hace que todas las rutas de este archivo empiecen con /paises,
# así en cada @bp.route no hace falta repetir "/paises".
bp = Blueprint("paises", __name__, url_prefix="/paises")


@bp.route("", methods=["GET"])
def listar_paises():
    """GET /paises -> lista de todos los países."""
    db = get_db()
    filas = db.execute("SELECT id, nombre, codigo_iso FROM paises ORDER BY nombre").fetchall()

    # dict(fila) convierte cada sqlite3.Row en un diccionario común,
    # que es lo que jsonify sabe serializar a JSON.
    paises = [dict(fila) for fila in filas]
    return jsonify(paises), 200


@bp.route("/<int:pais_id>", methods=["GET"])
def obtener_pais(pais_id):
    """GET /paises/<id> -> un país con sus provincias anidadas."""
    db = get_db()

    fila_pais = db.execute(
        "SELECT id, nombre, codigo_iso FROM paises WHERE id = ?", (pais_id,)
    ).fetchone()

    if fila_pais is None:
        # ApiError corta la ejecución acá mismo; app/errors.py arma la
        # respuesta 404 con el mensaje que le pasamos.
        raise ApiError(f"País con id {pais_id} no encontrado", 404)

    pais = dict(fila_pais)

    # Anidamos las provincias de este país dentro de la respuesta,
    # tal como pide el enunciado ("/paises/<id> (con provincias)").
    filas_provincias = db.execute(
        "SELECT id, nombre FROM provincias WHERE pais_id = ? ORDER BY nombre",
        (pais_id,),
    ).fetchall()
    pais["provincias"] = [dict(fila) for fila in filas_provincias]

    return jsonify(pais), 200
