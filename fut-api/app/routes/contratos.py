"""
app/routes/contratos.py — Endpoints de contratos.

Endpoints en este archivo:
    GET /contratos -> lista de contratos, con filtros opcionales combinables:
        ?jugador_id=<id>  -> contratos de un jugador puntual
        ?equipo_id=<id>   -> contratos de un equipo puntual
        ?activo=true|false -> fecha_fin IS NULL significa "activo" (regla de negocio del enunciado); fecha_fin IS NOT NULL significa que el contrato ya terminó.
    POST /contratos           -> alta de un contrato nuevo
    PUT /contratos/<id>       -> edición de un contrato (parcial)
    DELETE /contratos/<id>    -> borra el contrato (elimina la fila)
"""

from flask import Blueprint, jsonify, request

from app.db import get_db
from app.errors import ApiError
from app.validation import obtener_body_json, validar_campos_requeridos, validar_existe

bp = Blueprint("contratos", __name__, url_prefix="/contratos")


@bp.route("", methods=["GET"])
def listar_contratos():
    db = get_db()

    jugador_id = request.args.get("jugador_id")
    equipo_id = request.args.get("equipo_id")
    activo = request.args.get("activo")

    condiciones = []
    parametros = []

    if jugador_id is not None:
        condiciones.append("jugador_id = ?")
        parametros.append(jugador_id)

    if equipo_id is not None:
        condiciones.append("equipo_id = ?")
        parametros.append(equipo_id)

    if activo is not None:
        # Aceptamos "true"/"false" en cualquier capitalización 
        if activo.lower() == "true":
            condiciones.append("fecha_fin IS NULL")
        elif activo.lower() == "false":
            condiciones.append("fecha_fin IS NOT NULL")
        # Si viene un valor que no es "true" ni "false", lo ignoramos 

    where_sql = f" WHERE {' AND '.join(condiciones)}" if condiciones else ""

    filas = db.execute(
        f"""SELECT id, jugador_id, equipo_id, fecha_inicio, fecha_fin, precio_traspaso
            FROM contratos{where_sql}
            ORDER BY fecha_inicio DESC""",
        parametros,
    ).fetchall()

    contratos = [dict(fila) for fila in filas]
    return jsonify(contratos), 200


@bp.route("", methods=["POST"])
def crear_contrato():
    """
    POST /contratos -> alta de un contrato nuevo.
    """
    db = get_db()
    data = obtener_body_json()

    validar_campos_requeridos(data, ["jugador_id", "equipo_id", "fecha_inicio"])
    validar_existe(db, "jugadores", data["jugador_id"], "jugador")
    validar_existe(db, "equipos", data["equipo_id"], "equipo")

    cursor = db.execute(
        """INSERT INTO contratos (jugador_id, equipo_id, fecha_inicio, fecha_fin, precio_traspaso)
           VALUES (?, ?, ?, ?, ?)""",
        (
            data["jugador_id"],
            data["equipo_id"],
            data["fecha_inicio"],
            data.get("fecha_fin"),
            data.get("precio_traspaso"),
        ),
    )
    db.commit()

    nuevo_id = cursor.lastrowid
    creado = db.execute("SELECT * FROM contratos WHERE id = ?", (nuevo_id,)).fetchone()
    return jsonify(dict(creado)), 201


@bp.route("/<int:contrato_id>", methods=["PUT"])
def actualizar_contrato(contrato_id):
    """
    PUT /contratos/<id> -> edición de un contrato existente (parcial).
    """
    db = get_db()
    data = obtener_body_json()

    existente = db.execute("SELECT * FROM contratos WHERE id = ?", (contrato_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Contrato con id {contrato_id} no encontrado", 404)

    jugador_id = data.get("jugador_id", existente["jugador_id"])
    equipo_id = data.get("equipo_id", existente["equipo_id"])
    fecha_inicio = data.get("fecha_inicio", existente["fecha_inicio"])
    fecha_fin = data.get("fecha_fin", existente["fecha_fin"])
    precio_traspaso = data.get("precio_traspaso", existente["precio_traspaso"])

    if "jugador_id" in data:
        validar_existe(db, "jugadores", jugador_id, "jugador")
    if "equipo_id" in data:
        validar_existe(db, "equipos", equipo_id, "equipo")

    db.execute(
        """UPDATE contratos
           SET jugador_id = ?, equipo_id = ?, fecha_inicio = ?, fecha_fin = ?, precio_traspaso = ?
           WHERE id = ?""",
        (jugador_id, equipo_id, fecha_inicio, fecha_fin, precio_traspaso, contrato_id),
    )
    db.commit()

    actualizado = db.execute("SELECT * FROM contratos WHERE id = ?", (contrato_id,)).fetchone()
    return jsonify(dict(actualizado)), 200


@bp.route("/<int:contrato_id>", methods=["DELETE"])
def eliminar_contrato(contrato_id):
    """
    DELETE /contratos/<id> -> borra el contrato (elimina la fila).
    """
    db = get_db()

    existente = db.execute("SELECT id FROM contratos WHERE id = ?", (contrato_id,)).fetchone()
    if existente is None:
        raise ApiError(f"Contrato con id {contrato_id} no encontrado", 404)

    db.execute("DELETE FROM contratos WHERE id = ?", (contrato_id,))
    db.commit()
    return "", 204