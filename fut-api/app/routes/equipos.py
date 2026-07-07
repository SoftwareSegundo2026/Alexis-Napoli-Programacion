"""
app/routes/equipos.py — Endpoints de equipos.

Endpoints en este archivo:
    GET /equipos            -> lista de equipos (filtros ?club_id=, ?torneo_id=)
    GET /equipos/<id>        -> equipo con club, torneo y jugadores activos
    GET /equipos/<id>/partidos -> partidos de ese equipo (local o visitante)
    POST /equipos            -> inscribe un club a un torneo (crea la participación)
    PUT /equipos/<id>        -> actualiza un equipo (parcial, normalmente solo 'grupo')
    DELETE /equipos/<id>     -> da de baja la inscripción (rechaza si tiene partidos, contratos o campeonatos asociados)

"""

from flask import Blueprint, jsonify, request

from app.db import get_db
from app.errors import ApiError
from app.validation import obtener_body_json, validar_campos_requeridos, validar_existe

bp = Blueprint("equipos", __name__, url_prefix="/equipos")


@bp.route("", methods=["GET"])
def listar_equipos():
    """
    GET /equipos -> lista de equipos, con filtros opcionales combinables:
        ?club_id=<id>    -> equipos (participaciones) de un club puntual
        ?torneo_id=<id>  -> equipos inscriptos en un torneo puntual
    """
    db = get_db()
    club_id = request.args.get("club_id")
    torneo_id = request.args.get("torneo_id")

    condiciones = []
    parametros = []

    if club_id is not None:
        condiciones.append("equipos.club_id = ?")
        parametros.append(club_id)

    if torneo_id is not None:
        condiciones.append("equipos.torneo_id = ?")
        parametros.append(torneo_id)

    where_sql = f" WHERE {' AND '.join(condiciones)}" if condiciones else ""

    filas = db.execute(
        f"""SELECT
                equipos.id, equipos.club_id, equipos.torneo_id, equipos.grupo,
                clubes.nombre AS club_nombre,
                torneos.nombre AS torneo_nombre
            FROM equipos
            JOIN clubes  ON equipos.club_id = clubes.id
            JOIN torneos ON equipos.torneo_id = torneos.id
            {where_sql}
            ORDER BY equipos.torneo_id, clubes.nombre""",
        parametros,
    ).fetchall()

    equipos = [dict(fila) for fila in filas]
    return jsonify(equipos), 200


def _equipo_o_404(db, equipo_id):
    """Helper: busca el equipo con club y torneo resueltos, o corta con 404."""
    fila = db.execute(
        """SELECT
               equipos.id, equipos.grupo,
               clubes.id AS club_id, clubes.nombre AS club_nombre,
               torneos.id AS torneo_id, torneos.nombre AS torneo_nombre
           FROM equipos
           JOIN clubes  ON equipos.club_id = clubes.id
           JOIN torneos ON equipos.torneo_id = torneos.id
           WHERE equipos.id = ?""",
        (equipo_id,),
    ).fetchone()

    if fila is None:
        raise ApiError(f"Equipo con id {equipo_id} no encontrado", 404)

    return fila


@bp.route("/<int:equipo_id>", methods=["GET"])
def obtener_equipo(equipo_id):
    """GET /equipos/<id> -> equipo con club, torneo y jugadores activos."""
    db = get_db()
    fila = _equipo_o_404(db, equipo_id)

    equipo = {
        "id": fila["id"],
        "grupo": fila["grupo"],
        "club": {"id": fila["club_id"], "nombre": fila["club_nombre"]},
        "torneo": {"id": fila["torneo_id"], "nombre": fila["torneo_nombre"]},
    }

    filas_jugadores = db.execute(
        """SELECT
               jugadores.id, jugadores.nombre, jugadores.apellido, jugadores.posicion,
               contratos.fecha_inicio
           FROM contratos
           JOIN jugadores ON contratos.jugador_id = jugadores.id
           WHERE contratos.equipo_id = ? AND contratos.fecha_fin IS NULL
           ORDER BY jugadores.apellido""",
        (equipo_id,),
    ).fetchall()

    equipo["jugadores_activos"] = [dict(fila_jugador) for fila_jugador in filas_jugadores]

    return jsonify(equipo), 200


@bp.route("/<int:equipo_id>/partidos", methods=["GET"])
def obtener_partidos_de_equipo(equipo_id):
    """
    GET /equipos/<id>/partidos -> partidos donde este equipo jugó, de local o de visitante.
    """
    db = get_db()
    _equipo_o_404(db, equipo_id)  # valida que el equipo exista, corta con 404 si no

    filas = db.execute(
        """SELECT id, torneo_id, equipo_local_id, equipo_visitante_id,
                  fecha, goles_local, goles_visitante
           FROM partidos
           WHERE equipo_local_id = ? OR equipo_visitante_id = ?
           ORDER BY fecha""",
        (equipo_id, equipo_id),
    ).fetchall()

    partidos = [dict(fila) for fila in filas]
    return jsonify(partidos), 200


@bp.route("", methods=["POST"])
def crear_equipo():
    """
    POST /equipos -> inscribe un club a un torneo (crea la participación).
    """
    db = get_db()
    data = obtener_body_json()

    validar_campos_requeridos(data, ["club_id", "torneo_id"])
    validar_existe(db, "clubes", data["club_id"], "club")
    validar_existe(db, "torneos", data["torneo_id"], "torneo")

    cursor = db.execute(
        "INSERT INTO equipos (club_id, torneo_id, grupo) VALUES (?, ?, ?)",
        (data["club_id"], data["torneo_id"], data.get("grupo")),
    )
    db.commit()

    nuevo_id = cursor.lastrowid
    creado = db.execute("SELECT * FROM equipos WHERE id = ?", (nuevo_id,)).fetchone()
    return jsonify(dict(creado)), 201


@bp.route("/<int:equipo_id>", methods=["PUT"])
def actualizar_equipo(equipo_id):
    """
    PUT /equipos/<id> -> actualiza un equipo existente (parcial).
    """
    db = get_db()
    data = obtener_body_json()

    existente = db.execute("SELECT * FROM equipos WHERE id = ?", (equipo_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Equipo con id {equipo_id} no encontrado", 404)

    club_id = data.get("club_id", existente["club_id"])
    torneo_id = data.get("torneo_id", existente["torneo_id"])
    grupo = data.get("grupo", existente["grupo"])

    if "club_id" in data:
        validar_existe(db, "clubes", club_id, "club")
    if "torneo_id" in data:
        validar_existe(db, "torneos", torneo_id, "torneo")

    db.execute(
        "UPDATE equipos SET club_id = ?, torneo_id = ?, grupo = ? WHERE id = ?",
        (club_id, torneo_id, grupo, equipo_id),
    )
    db.commit()

    actualizado = db.execute("SELECT * FROM equipos WHERE id = ?", (equipo_id,)).fetchone()
    return jsonify(dict(actualizado)), 200


@bp.route("/<int:equipo_id>", methods=["DELETE"])
def eliminar_equipo(equipo_id):
    """
    DELETE /equipos/<id> -> da de baja una inscripción club-torneo.
    """
    db = get_db()

    existente = db.execute("SELECT id FROM equipos WHERE id = ?", (equipo_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Equipo con id {equipo_id} no encontrado", 404)

    dependencias = {
        "partidos": "SELECT COUNT(*) AS c FROM partidos WHERE equipo_local_id = ? OR equipo_visitante_id = ?",
        "contratos": "SELECT COUNT(*) AS c FROM contratos WHERE equipo_id = ?",
        "campeonatos_ganados": "SELECT COUNT(*) AS c FROM campeonatos_ganados WHERE equipo_id = ?",
    }

    for nombre_tabla, consulta in dependencias.items():
        parametros = (equipo_id, equipo_id) if nombre_tabla == "partidos" else (equipo_id,)
        cantidad = db.execute(consulta, parametros).fetchone()["c"]
        if cantidad > 0:
            raise ApiError(
                f"No se puede eliminar el equipo: tiene {cantidad} registro(s) "
                f"asociado(s) en {nombre_tabla}. Eliminá primero esos registros.",
                409,
            )

    db.execute("DELETE FROM equipos WHERE id = ?", (equipo_id,))
    db.commit()
    return "", 204