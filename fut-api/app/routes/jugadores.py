"""
app/routes/jugadores.py — Endpoints de jugadores.

Endpoints en este archivo:
    GET /jugadores          -> lista jugadores (filtros ?posicion=, ?nacionalidad_id=)
    GET /jugadores/<id>      -> jugador con historial de contratos
    POST /jugadores          -> crea un jugador nuevo
    PUT /jugadores/<id>      -> actualiza un jugador (parcial)
    DELETE /jugadores/<id>   -> borra un jugador (rechaza si tiene contratos)
    GET /jugadores/<id>/trayectoria -> solo el historial de contratos
"""

from flask import Blueprint, jsonify, request

from app.db import get_db
from app.errors import ApiError
from app.validation import obtener_body_json, validar_campos_requeridos, validar_existe

bp = Blueprint("jugadores", __name__, url_prefix="/jugadores")

# Catálogo cerrado de posiciones válidas (coincide con el CHECK del schema.sql).
POSICIONES_VALIDAS = {"ARQ", "DEF", "MED", "DEL"}


@bp.route("", methods=["GET"])
def listar_jugadores():
    """
    GET /jugadores -> lista de jugadores, con filtros opcionales combinables:
        ?posicion=<ARQ|DEF|MED|DEL>
        ?nacionalidad_id=<id>
    """
    db = get_db()
    posicion = request.args.get("posicion")
    nacionalidad_id = request.args.get("nacionalidad_id")

    condiciones = []
    parametros = []

    if posicion is not None:
        condiciones.append("posicion = ?")
        parametros.append(posicion)

    if nacionalidad_id is not None:
        condiciones.append("nacionalidad_id = ?")
        parametros.append(nacionalidad_id)

    where_sql = f" WHERE {' AND '.join(condiciones)}" if condiciones else ""

    filas = db.execute(
        f"""SELECT id, nombre, apellido, fecha_nacimiento, nacionalidad_id, posicion
            FROM jugadores{where_sql}
            ORDER BY apellido, nombre""",
        parametros,
    ).fetchall()

    jugadores = [dict(fila) for fila in filas]
    return jsonify(jugadores), 200


def _obtener_historial_contratos(db, jugador_id):
    filas = db.execute(
        """SELECT
               contratos.id AS contrato_id,
               contratos.fecha_inicio, contratos.fecha_fin, contratos.precio_traspaso,
               clubes.id AS club_id, clubes.nombre AS club_nombre,
               torneos.id AS torneo_id, torneos.nombre AS torneo_nombre
           FROM contratos
           JOIN equipos ON contratos.equipo_id = equipos.id
           JOIN clubes  ON equipos.club_id = clubes.id
           JOIN torneos ON equipos.torneo_id = torneos.id
           WHERE contratos.jugador_id = ?
           ORDER BY contratos.fecha_inicio""",
        (jugador_id,),
    ).fetchall()

    return [
        {
            "contrato_id": fila["contrato_id"],
            "club": {"id": fila["club_id"], "nombre": fila["club_nombre"]},
            "torneo": {"id": fila["torneo_id"], "nombre": fila["torneo_nombre"]},
            "fecha_inicio": fila["fecha_inicio"],
            "fecha_fin": fila["fecha_fin"],  # null = activo en ese club/equipo
            "precio_traspaso": fila["precio_traspaso"],
        }
        for fila in filas
    ]


@bp.route("/<int:jugador_id>", methods=["GET"])
def obtener_jugador(jugador_id):
    """
    GET /jugadores/<id> -> jugador con su país (nacionalidad, nombre
    resuelto) y su historial de contratos completo.
    """
    db = get_db()

    fila = db.execute(
        """SELECT
               jugadores.id, jugadores.nombre, jugadores.apellido,
               jugadores.fecha_nacimiento, jugadores.posicion,
               paises.id AS pais_id, paises.nombre AS pais_nombre
           FROM jugadores
           JOIN paises ON jugadores.nacionalidad_id = paises.id
           WHERE jugadores.id = ?""",
        (jugador_id,),
    ).fetchone()

    if fila is None:
        raise ApiError(f"Jugador con id {jugador_id} no encontrado", 404)

    jugador = {
        "id": fila["id"],
        "nombre": fila["nombre"],
        "apellido": fila["apellido"],
        "fecha_nacimiento": fila["fecha_nacimiento"],
        "posicion": fila["posicion"],
        "nacionalidad": {"id": fila["pais_id"], "nombre": fila["pais_nombre"]},
        "historial_contratos": _obtener_historial_contratos(db, jugador_id),
    }

    return jsonify(jugador), 200


@bp.route("", methods=["POST"])
def crear_jugador():
    """
    POST /jugadores -> crea un jugador nuevo.
    """
    db = get_db()
    data = obtener_body_json()

    validar_campos_requeridos(
        data, ["nombre", "apellido", "fecha_nacimiento", "nacionalidad_id", "posicion"]
    )

    if data["posicion"] not in POSICIONES_VALIDAS:
        raise ApiError(f"posicion debe ser una de {sorted(POSICIONES_VALIDAS)}", 400)

    validar_existe(db, "paises", data["nacionalidad_id"], "país (nacionalidad)")

    cursor = db.execute(
        """INSERT INTO jugadores (nombre, apellido, fecha_nacimiento, nacionalidad_id, posicion)
           VALUES (?, ?, ?, ?, ?)""",
        (
            data["nombre"],
            data["apellido"],
            data["fecha_nacimiento"],
            data["nacionalidad_id"],
            data["posicion"],
        ),
    )
    db.commit()

    nuevo_id = cursor.lastrowid
    creado = db.execute("SELECT * FROM jugadores WHERE id = ?", (nuevo_id,)).fetchone()
    return jsonify(dict(creado)), 201


@bp.route("/<int:jugador_id>", methods=["PUT"])
def actualizar_jugador(jugador_id):
    """PUT /jugadores/<id> -> actualiza un jugador existente (parcial)."""
    db = get_db()
    data = obtener_body_json()

    existente = db.execute("SELECT * FROM jugadores WHERE id = ?", (jugador_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Jugador con id {jugador_id} no encontrado", 404)

    nombre = data.get("nombre", existente["nombre"])
    apellido = data.get("apellido", existente["apellido"])
    fecha_nacimiento = data.get("fecha_nacimiento", existente["fecha_nacimiento"])
    nacionalidad_id = data.get("nacionalidad_id", existente["nacionalidad_id"])
    posicion = data.get("posicion", existente["posicion"])

    if "posicion" in data and data["posicion"] not in POSICIONES_VALIDAS:
        raise ApiError(f"posicion debe ser una de {sorted(POSICIONES_VALIDAS)}", 400)

    if "nacionalidad_id" in data:
        validar_existe(db, "paises", nacionalidad_id, "país (nacionalidad)")

    db.execute(
        """UPDATE jugadores
           SET nombre = ?, apellido = ?, fecha_nacimiento = ?, nacionalidad_id = ?, posicion = ?
           WHERE id = ?""",
        (nombre, apellido, fecha_nacimiento, nacionalidad_id, posicion, jugador_id),
    )
    db.commit()

    actualizado = db.execute("SELECT * FROM jugadores WHERE id = ?", (jugador_id,)).fetchone()
    return jsonify(dict(actualizado)), 200


@bp.route("/<int:jugador_id>", methods=["DELETE"])
def eliminar_jugador(jugador_id):
    """
    DELETE /jugadores/<id> -> borra un jugador.
    """
    db = get_db()

    existente = db.execute("SELECT id FROM jugadores WHERE id = ?", (jugador_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Jugador con id {jugador_id} no encontrado", 404)

    cantidad_contratos = db.execute(
        "SELECT COUNT(*) AS cantidad FROM contratos WHERE jugador_id = ?", (jugador_id,)
    ).fetchone()["cantidad"]

    if cantidad_contratos > 0:
        raise ApiError(
            f"No se puede eliminar el jugador: tiene {cantidad_contratos} "
            "contrato(s) asociado(s). Eliminá primero esos contratos.",
            409,
        )

    db.execute("DELETE FROM jugadores WHERE id = ?", (jugador_id,))
    db.commit()
    return "", 204


@bp.route("/<int:jugador_id>/trayectoria", methods=["GET"])
def obtener_trayectoria(jugador_id):
    db = get_db()

    existe = db.execute("SELECT id FROM jugadores WHERE id = ?", (jugador_id,)).fetchone()
    if existe is None:
        raise ApiError(f"Jugador con id {jugador_id} no encontrado", 404)

    return jsonify(_obtener_historial_contratos(db, jugador_id)), 200