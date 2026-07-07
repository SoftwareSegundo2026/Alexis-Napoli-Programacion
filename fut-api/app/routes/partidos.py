"""
app/routes/partidos.py — Endpoints de partidos.

Endpoints en este archivo:
    GET /partidos -> lista de partidos, con filtros opcionales combinables:
        ?torneo_id=<id>      -> partidos de un torneo puntual
        ?equipo_id=<id>      -> partidos donde ese equipo jugó, sea local o visitante
        ?fecha_desde=<fecha> -> partidos desde esa fecha (inclusive), formato YYYY-MM-DD
        ?fecha_hasta=<fecha> -> partidos hasta esa fecha (inclusive), formato YYYY-MM-DD
    POST /partidos       -> crea un partido nuevo
    PUT /partidos/<id>   -> actualiza un partido (parcial)
    DELETE /partidos/<id> -> borra un partido (sin restricciones: ninguna
                             otra tabla depende de un partido puntual)
"""

from flask import Blueprint, jsonify, request

from app.db import get_db
from app.errors import ApiError
from app.validation import obtener_body_json, validar_campos_requeridos, validar_existe

bp = Blueprint("partidos", __name__, url_prefix="/partidos")


def _validar_goles(goles_local, goles_visitante):
    for nombre_campo, valor in (("goles_local", goles_local), ("goles_visitante", goles_visitante)):
        if not isinstance(valor, int) or isinstance(valor, bool) or valor < 0:
            raise ApiError(f"{nombre_campo} debe ser un número entero mayor o igual a 0", 400)


@bp.route("", methods=["GET"])
def listar_partidos():
    db = get_db()

    torneo_id = request.args.get("torneo_id")
    equipo_id = request.args.get("equipo_id")
    fecha_desde = request.args.get("fecha_desde")
    fecha_hasta = request.args.get("fecha_hasta")

    condiciones = []
    parametros = []

    if torneo_id is not None:
        condiciones.append("torneo_id = ?")
        parametros.append(torneo_id)

    if equipo_id is not None:
        condiciones.append("(equipo_local_id = ? OR equipo_visitante_id = ?)")
        parametros.append(equipo_id)
        parametros.append(equipo_id)

    if fecha_desde is not None:
        condiciones.append("fecha >= ?")
        parametros.append(fecha_desde)

    if fecha_hasta is not None:
        condiciones.append("fecha <= ?")
        parametros.append(fecha_hasta)

    where_sql = f" WHERE {' AND '.join(condiciones)}" if condiciones else ""

    filas = db.execute(
        f"""SELECT id, torneo_id, equipo_local_id, equipo_visitante_id,
                   fecha, goles_local, goles_visitante
            FROM partidos{where_sql}
            ORDER BY fecha""",
        parametros,
    ).fetchall()

    partidos = [dict(fila) for fila in filas]
    return jsonify(partidos), 200


@bp.route("", methods=["POST"])
def crear_partido():
    """
    POST /partidos -> crea un partido nuevo.
    """
    db = get_db()
    data = obtener_body_json()

    validar_campos_requeridos(
        data,
        ["torneo_id", "equipo_local_id", "equipo_visitante_id", "fecha", "goles_local", "goles_visitante"],
    )

    if data["equipo_local_id"] == data["equipo_visitante_id"]:
        raise ApiError("equipo_local_id y equipo_visitante_id no pueden ser el mismo equipo", 400)

    _validar_goles(data["goles_local"], data["goles_visitante"])

    validar_existe(db, "torneos", data["torneo_id"], "torneo")
    validar_existe(db, "equipos", data["equipo_local_id"], "equipo local")
    validar_existe(db, "equipos", data["equipo_visitante_id"], "equipo visitante")

    cursor = db.execute(
        """INSERT INTO partidos
               (torneo_id, equipo_local_id, equipo_visitante_id, fecha, goles_local, goles_visitante)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            data["torneo_id"],
            data["equipo_local_id"],
            data["equipo_visitante_id"],
            data["fecha"],
            data["goles_local"],
            data["goles_visitante"],
        ),
    )
    db.commit()

    nuevo_id = cursor.lastrowid
    creado = db.execute("SELECT * FROM partidos WHERE id = ?", (nuevo_id,)).fetchone()
    return jsonify(dict(creado)), 201


@bp.route("/<int:partido_id>", methods=["PUT"])
def actualizar_partido(partido_id):
    """PUT /partidos/<id> -> actualiza un partido existente (parcial)."""
    db = get_db()
    data = obtener_body_json()

    existente = db.execute("SELECT * FROM partidos WHERE id = ?", (partido_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Partido con id {partido_id} no encontrado", 404)

    torneo_id = data.get("torneo_id", existente["torneo_id"])
    equipo_local_id = data.get("equipo_local_id", existente["equipo_local_id"])
    equipo_visitante_id = data.get("equipo_visitante_id", existente["equipo_visitante_id"])
    fecha = data.get("fecha", existente["fecha"])
    goles_local = data.get("goles_local", existente["goles_local"])
    goles_visitante = data.get("goles_visitante", existente["goles_visitante"])

    if equipo_local_id == equipo_visitante_id:
        raise ApiError("equipo_local_id y equipo_visitante_id no pueden ser el mismo equipo", 400)

    _validar_goles(goles_local, goles_visitante)

    if "torneo_id" in data:
        validar_existe(db, "torneos", torneo_id, "torneo")
    if "equipo_local_id" in data:
        validar_existe(db, "equipos", equipo_local_id, "equipo local")
    if "equipo_visitante_id" in data:
        validar_existe(db, "equipos", equipo_visitante_id, "equipo visitante")

    db.execute(
        """UPDATE partidos
           SET torneo_id = ?, equipo_local_id = ?, equipo_visitante_id = ?,
               fecha = ?, goles_local = ?, goles_visitante = ?
           WHERE id = ?""",
        (torneo_id, equipo_local_id, equipo_visitante_id, fecha, goles_local, goles_visitante, partido_id),
    )
    db.commit()

    actualizado = db.execute("SELECT * FROM partidos WHERE id = ?", (partido_id,)).fetchone()
    return jsonify(dict(actualizado)), 200


@bp.route("/<int:partido_id>", methods=["DELETE"])
def eliminar_partido(partido_id):
    """
    DELETE /partidos/<id> -> borra un partido.
    """
    db = get_db()

    existente = db.execute("SELECT id FROM partidos WHERE id = ?", (partido_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Partido con id {partido_id} no encontrado", 404)

    db.execute("DELETE FROM partidos WHERE id = ?", (partido_id,))
    db.commit()
    return "", 204