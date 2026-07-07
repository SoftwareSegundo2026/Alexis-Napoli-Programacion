"""
app/routes/torneos.py — Endpoints de torneos.

Endpoints en este archivo:
    GET /torneos              -> lista de torneos (filtros ?liga_id=, ?temporada_id=)
    GET /torneos/<id>         -> torneo con liga, temporada y tabla de posiciones
    GET /torneos/<id>/tabla   -> solo la tabla de posiciones
    POST /torneos             -> crea un torneo nuevo
    PUT /torneos/<id>         -> actualiza un torneo (parcial)
    DELETE /torneos/<id>      -> borra un torneo (rechaza si tiene equipos inscriptos)
"""

from flask import Blueprint, jsonify, request

from app.db import get_db
from app.errors import ApiError
from app.validation import obtener_body_json, validar_campos_requeridos, validar_existe

bp = Blueprint("torneos", __name__, url_prefix="/torneos")


@bp.route("", methods=["GET"])
def listar_torneos():
    """
    GET /torneos -> lista de torneos.
    Filtros opcionales combinables: ?liga_id=<id> y/o ?temporada_id=<id>.
    """
    db = get_db()
    liga_id = request.args.get("liga_id")
    temporada_id = request.args.get("temporada_id")

    condiciones = []
    parametros = []

    if liga_id is not None:
        condiciones.append("liga_id = ?")
        parametros.append(liga_id)

    if temporada_id is not None:
        condiciones.append("temporada_id = ?")
        parametros.append(temporada_id)

    where_sql = f" WHERE {' AND '.join(condiciones)}" if condiciones else ""

    filas = db.execute(
        f"""SELECT id, nombre, liga_id, temporada_id, fecha_inicio, fecha_fin
            FROM torneos{where_sql}
            ORDER BY fecha_inicio DESC""",
        parametros,
    ).fetchall()

    torneos = [dict(fila) for fila in filas]
    return jsonify(torneos), 200


def _torneo_o_404(db, torneo_id):
    fila = db.execute(
        """SELECT
               torneos.id, torneos.nombre, torneos.fecha_inicio, torneos.fecha_fin,
               ligas.id AS liga_id, ligas.nombre AS liga_nombre,
               temporadas.id AS temporada_id, temporadas.nombre AS temporada_nombre
           FROM torneos
           JOIN ligas      ON torneos.liga_id = ligas.id
           JOIN temporadas ON torneos.temporada_id = temporadas.id
           WHERE torneos.id = ?""",
        (torneo_id,),
    ).fetchone()

    if fila is None:
        raise ApiError(f"Torneo con id {torneo_id} no encontrado", 404)

    return fila


def calcular_tabla_posiciones(db, torneo_id):
    equipos = db.execute(
        """SELECT equipos.id AS equipo_id, equipos.grupo, clubes.nombre AS club_nombre
           FROM equipos
           JOIN clubes ON equipos.club_id = clubes.id
           WHERE equipos.torneo_id = ?""",
        (torneo_id,),
    ).fetchall()

    tabla = []
    for equipo in equipos:
        equipo_id = equipo["equipo_id"]

        partidos = db.execute(
            """SELECT equipo_local_id, equipo_visitante_id, goles_local, goles_visitante
               FROM partidos
               WHERE torneo_id = ? AND (equipo_local_id = ? OR equipo_visitante_id = ?)""",
            (torneo_id, equipo_id, equipo_id),
        ).fetchall()

        pj = pg = pe = pp = gf = gc = 0

        for partido in partidos:
            jugo_de_local = partido["equipo_local_id"] == equipo_id
            goles_favor = partido["goles_local"] if jugo_de_local else partido["goles_visitante"]
            goles_contra = partido["goles_visitante"] if jugo_de_local else partido["goles_local"]

            pj += 1
            gf += goles_favor
            gc += goles_contra

            if goles_favor > goles_contra:
                pg += 1
            elif goles_favor == goles_contra:
                pe += 1
            else:
                pp += 1

        tabla.append(
            {
                "equipo_id": equipo_id,
                "club_nombre": equipo["club_nombre"],
                "grupo": equipo["grupo"],  # útil cuando un club está inscripto más de una vez al mismo torneo
                "pts": pg * 3 + pe * 1,
                "pj": pj,
                "pg": pg,
                "pe": pe,
                "pp": pp,
                "gf": gf,
                "gc": gc,
                "dg": gf - gc,
            }
        )

    tabla.sort(key=lambda fila: (-fila["pts"], -fila["dg"], -fila["gf"]))
    return tabla


@bp.route("/<int:torneo_id>", methods=["GET"])
def obtener_torneo(torneo_id):
    """GET /torneos/<id> -> torneo con liga, temporada y tabla de posiciones."""
    db = get_db()
    fila = _torneo_o_404(db, torneo_id)

    torneo = {
        "id": fila["id"],
        "nombre": fila["nombre"],
        "fecha_inicio": fila["fecha_inicio"],
        "fecha_fin": fila["fecha_fin"],
        "liga": {"id": fila["liga_id"], "nombre": fila["liga_nombre"]},
        "temporada": {"id": fila["temporada_id"], "nombre": fila["temporada_nombre"]},
        "tabla_posiciones": calcular_tabla_posiciones(db, torneo_id),
    }

    return jsonify(torneo), 200


@bp.route("/<int:torneo_id>/tabla", methods=["GET"])
def obtener_tabla(torneo_id):
    """
    GET /torneos/<id>/tabla -> solo la tabla de posiciones 
    """
    db = get_db()
    _torneo_o_404(db, torneo_id)  # valida que el torneo exista, corta con 404 si no
    return jsonify(calcular_tabla_posiciones(db, torneo_id)), 200


@bp.route("", methods=["POST"])
def crear_torneo():
    """
    POST /torneos -> crea un torneo nuevo.
    """
    db = get_db()
    data = obtener_body_json()

    validar_campos_requeridos(data, ["nombre", "liga_id", "temporada_id", "fecha_inicio"])
    validar_existe(db, "ligas", data["liga_id"], "liga")
    validar_existe(db, "temporadas", data["temporada_id"], "temporada")

    cursor = db.execute(
        """INSERT INTO torneos (nombre, liga_id, temporada_id, fecha_inicio, fecha_fin)
           VALUES (?, ?, ?, ?, ?)""",
        (
            data["nombre"],
            data["liga_id"],
            data["temporada_id"],
            data["fecha_inicio"],
            data.get("fecha_fin"),
        ),
    )
    db.commit()

    nuevo_id = cursor.lastrowid
    creado = db.execute("SELECT * FROM torneos WHERE id = ?", (nuevo_id,)).fetchone()
    return jsonify(dict(creado)), 201


@bp.route("/<int:torneo_id>", methods=["PUT"])
def actualizar_torneo(torneo_id):
    """PUT /torneos/<id> -> actualiza un torneo existente (parcial)."""
    db = get_db()
    data = obtener_body_json()

    existente = db.execute("SELECT * FROM torneos WHERE id = ?", (torneo_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Torneo con id {torneo_id} no encontrado", 404)

    nombre = data.get("nombre", existente["nombre"])
    liga_id = data.get("liga_id", existente["liga_id"])
    temporada_id = data.get("temporada_id", existente["temporada_id"])
    fecha_inicio = data.get("fecha_inicio", existente["fecha_inicio"])
    fecha_fin = data.get("fecha_fin", existente["fecha_fin"])

    if "liga_id" in data:
        validar_existe(db, "ligas", liga_id, "liga")
    if "temporada_id" in data:
        validar_existe(db, "temporadas", temporada_id, "temporada")

    db.execute(
        """UPDATE torneos
           SET nombre = ?, liga_id = ?, temporada_id = ?, fecha_inicio = ?, fecha_fin = ?
           WHERE id = ?""",
        (nombre, liga_id, temporada_id, fecha_inicio, fecha_fin, torneo_id),
    )
    db.commit()

    actualizado = db.execute("SELECT * FROM torneos WHERE id = ?", (torneo_id,)).fetchone()
    return jsonify(dict(actualizado)), 200


@bp.route("/<int:torneo_id>", methods=["DELETE"])
def eliminar_torneo(torneo_id):
    """
    DELETE /torneos/<id> -> borra un torneo.
    """
    db = get_db()

    existente = db.execute("SELECT id FROM torneos WHERE id = ?", (torneo_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Torneo con id {torneo_id} no encontrado", 404)

    cantidad_equipos = db.execute(
        "SELECT COUNT(*) AS cantidad FROM equipos WHERE torneo_id = ?", (torneo_id,)
    ).fetchone()["cantidad"]

    if cantidad_equipos > 0:
        raise ApiError(
            f"No se puede eliminar el torneo: tiene {cantidad_equipos} equipo(s) "
            "inscripto(s). Eliminá primero esas inscripciones.",
            409,
        )

    db.execute("DELETE FROM torneos WHERE id = ?", (torneo_id,))
    db.commit()
    return "", 204