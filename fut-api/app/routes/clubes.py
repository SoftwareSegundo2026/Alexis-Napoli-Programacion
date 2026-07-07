"""
app/routes/clubes.py — Endpoints de clubes.

Endpoints en este archivo:
    GET /clubes        -> lista todos los clubes, ordenados por nombre
    GET /clubes/<id>   -> un club puntual, con ciudad, provincia, país y sus equipos (participaciones en torneos)
    POST /clubes       -> crea un club nuevo
    PUT /clubes/<id>   -> actualiza un club (actualización PARCIAL, ver nota abajo)
    DELETE /clubes/<id> -> borra un club (rechaza si tiene equipos asociados)
"""

from flask import Blueprint, jsonify

from app.db import get_db
from app.errors import ApiError
from app.validation import obtener_body_json, validar_campos_requeridos, validar_existe

bp = Blueprint("clubes", __name__, url_prefix="/clubes")


@bp.route("", methods=["GET"])
def listar_clubes():
    """GET /clubes -> lista de clubes ordenados alfabéticamente por nombre."""
    db = get_db()
    filas = db.execute(
        """SELECT id, nombre, ciudad_id, fundacion, estadio, capacidad
           FROM clubes
           ORDER BY nombre"""
    ).fetchall()

    clubes = [dict(fila) for fila in filas]
    return jsonify(clubes), 200


@bp.route("/<int:club_id>", methods=["GET"])
def obtener_club(club_id):
    """
    GET /clubes/<id> -> club con ciudad, provincia, país y equipos anidados.
    """
    db = get_db()

    fila_club = db.execute(
        (club_id,),
    ).fetchone()

    if fila_club is None:
        raise ApiError(f"Club con id {club_id} no encontrado", 404)

    # Armamos el JSON de salida "a mano" en vez de hacer dict(fila_club)
    # directo, porque queremos anidar ciudad/provincia/país como objetos
    # propios (más legible para quien consuma la API)
    club = {
        "id": fila_club["id"],
        "nombre": fila_club["nombre"],
        "fundacion": fila_club["fundacion"],
        "estadio": fila_club["estadio"],
        "capacidad": fila_club["capacidad"],
        "ciudad": {
            "id": fila_club["ciudad_id"],
            "nombre": fila_club["ciudad_nombre"],
        },
        "provincia": {
            "id": fila_club["provincia_id"],
            "nombre": fila_club["provincia_nombre"],
        },
        "pais": {
            "id": fila_club["pais_id"],
            "nombre": fila_club["pais_nombre"],
        },
    }

    filas_equipos = db.execute(
        """SELECT
               equipos.id, equipos.torneo_id, equipos.grupo,
               torneos.nombre AS torneo_nombre
           FROM equipos
           JOIN torneos ON equipos.torneo_id = torneos.id
           WHERE equipos.club_id = ?
           ORDER BY torneos.fecha_inicio DESC""",
        (club_id,),
    ).fetchall()

    club["equipos"] = [
        {
            "id": fila["id"],
            "torneo_id": fila["torneo_id"],
            "torneo_nombre": fila["torneo_nombre"],
            "grupo": fila["grupo"],
        }
        for fila in filas_equipos
    ]

    return jsonify(club), 200


@bp.route("", methods=["POST"])
def crear_club():
    """
    POST /clubes -> crea un club nuevo.
    """
    db = get_db()
    data = obtener_body_json()

    validar_campos_requeridos(data, ["nombre", "ciudad_id"])
    validar_existe(db, "ciudades", data["ciudad_id"], "ciudad")

    # data.get("fundacion") (sin valor por defecto) devuelve None si no vino
    # en el body, y sqlite3 convierte ese None a NULL automáticamente -
    # coincide con que esas columnas son opcionales en el schema.
    cursor = db.execute(
        """INSERT INTO clubes (nombre, ciudad_id, fundacion, estadio, capacidad)
           VALUES (?, ?, ?, ?, ?)""",
        (
            data["nombre"],
            data["ciudad_id"],
            data.get("fundacion"),
            data.get("estadio"),
            data.get("capacidad"),
        ),
    )
    db.commit()

    # cursor.lastrowid nos da el id que SQLite le asignó automáticamente
    nuevo_id = cursor.lastrowid
    club_creado = db.execute("SELECT * FROM clubes WHERE id = ?", (nuevo_id,)).fetchone()

    return jsonify(dict(club_creado)), 201


@bp.route("/<int:club_id>", methods=["PUT"])
def actualizar_club(club_id):
    """
    PUT /clubes/<id> -> actualiza un club existente 
    """
    db = get_db()
    data = obtener_body_json()

    existente = db.execute("SELECT * FROM clubes WHERE id = ?", (club_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Club con id {club_id} no encontrado", 404)

    # data.get(campo, valor_actual): si el campo vino en el body lo usamos, si no, mantenemos el valor que ya tenía la fila 
    nombre = data.get("nombre", existente["nombre"])
    ciudad_id = data.get("ciudad_id", existente["ciudad_id"])
    fundacion = data.get("fundacion", existente["fundacion"])
    estadio = data.get("estadio", existente["estadio"])
    capacidad = data.get("capacidad", existente["capacidad"])

    # Solo validamos que la ciudad exista si realmente vino un ciudad_id nuevo en el body 
    if "ciudad_id" in data:
        validar_existe(db, "ciudades", ciudad_id, "ciudad")

    db.execute(
        """UPDATE clubes SET nombre = ?, ciudad_id = ?, fundacion = ?, estadio = ?, capacidad = ?
           WHERE id = ?""",
        (nombre, ciudad_id, fundacion, estadio, capacidad, club_id),
    )
    db.commit()

    actualizado = db.execute("SELECT * FROM clubes WHERE id = ?", (club_id,)).fetchone()
    return jsonify(dict(actualizado)), 200


@bp.route("/<int:club_id>", methods=["DELETE"])
def eliminar_club(club_id):
    """
    DELETE /clubes/<id> -> borra un club.
    """
    db = get_db()

    existente = db.execute("SELECT id FROM clubes WHERE id = ?", (club_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Club con id {club_id} no encontrado", 404)

    cantidad_equipos = db.execute(
        "SELECT COUNT(*) AS cantidad FROM equipos WHERE club_id = ?", (club_id,)
    ).fetchone()["cantidad"]

    if cantidad_equipos > 0:
        raise ApiError(
            f"No se puede eliminar el club: tiene {cantidad_equipos} equipo(s) "
            "asociado(s) a torneos. Eliminá primero esas inscripciones.",
            409,
        )

    db.execute("DELETE FROM clubes WHERE id = ?", (club_id,))
    db.commit()

    # 204 No Content: la operación fue exitosa y no hay nada que devolver
    # en el body (es la convención estándar para DELETE exitoso).
    return "", 204