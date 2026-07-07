"""
app/routes/extra.py 

Endpoints en este archivo:
    GET /mercado-pases -> traspasos ordenados por monto descendente
    GET /estadisticas   -> estadísticas generales del dataset
"""

from flask import Blueprint, jsonify

from app.db import get_db

bp = Blueprint("extra", __name__)


@bp.route("/mercado-pases", methods=["GET"])
def mercado_pases():
    """
    GET /mercado-pases -> lista de traspasos (contratos con precio_traspaso no nulo), ordenados de mayor a menor monto.
    """
    db = get_db()

    filas = db.execute(
        """SELECT
               contratos.id AS contrato_id,
               contratos.precio_traspaso, contratos.fecha_inicio,
               jugadores.id AS jugador_id,
               jugadores.nombre AS jugador_nombre,
               jugadores.apellido AS jugador_apellido,
               clubes.id AS club_id,
               clubes.nombre AS club_nombre
           FROM contratos
           JOIN jugadores ON contratos.jugador_id = jugadores.id
           JOIN equipos   ON contratos.equipo_id = equipos.id
           JOIN clubes    ON equipos.club_id = clubes.id
           WHERE contratos.precio_traspaso IS NOT NULL
           ORDER BY contratos.precio_traspaso DESC""",
    ).fetchall()

    traspasos = [
        {
            "contrato_id": fila["contrato_id"],
            "jugador": {
                "id": fila["jugador_id"],
                "nombre_completo": f"{fila['jugador_nombre']} {fila['jugador_apellido']}",
            },
            "club_destino": {"id": fila["club_id"], "nombre": fila["club_nombre"]},
            "precio_traspaso": fila["precio_traspaso"],
            "fecha": fila["fecha_inicio"],
        }
        for fila in filas
    ]

    return jsonify(traspasos), 200


@bp.route("/estadisticas", methods=["GET"])
def estadisticas():
    """
    GET /estadisticas -> estadísticas generales del dataset.
    """
    db = get_db()

    totales = {
        "total_paises": db.execute("SELECT COUNT(*) AS c FROM paises").fetchone()["c"],
        "total_clubes": db.execute("SELECT COUNT(*) AS c FROM clubes").fetchone()["c"],
        "total_jugadores": db.execute("SELECT COUNT(*) AS c FROM jugadores").fetchone()["c"],
        "total_torneos": db.execute("SELECT COUNT(*) AS c FROM torneos").fetchone()["c"],
        "total_partidos": db.execute("SELECT COUNT(*) AS c FROM partidos").fetchone()["c"],
    }

    # Goles totales y promedio por partido (sumamos ambos marcadores de cada fila).
    fila_goles = db.execute(
        "SELECT SUM(goles_local + goles_visitante) AS total, COUNT(*) AS cantidad FROM partidos"
    ).fetchone()
    total_goles = fila_goles["total"] or 0
    cantidad_partidos = fila_goles["cantidad"] or 0
    promedio_goles_por_partido = round(total_goles / cantidad_partidos, 2) if cantidad_partidos > 0 else 0

    filas_titulos = db.execute(
        """SELECT clubes.id, clubes.nombre, COUNT(*) AS cantidad_titulos
           FROM campeonatos_ganados
           JOIN equipos ON campeonatos_ganados.equipo_id = equipos.id
           JOIN clubes  ON equipos.club_id = clubes.id
           WHERE campeonatos_ganados.posicion = 'CAMPEON'
           GROUP BY clubes.id
           HAVING cantidad_titulos = (
               SELECT MAX(cantidad) FROM (
                   SELECT COUNT(*) AS cantidad
                   FROM campeonatos_ganados
                   JOIN equipos ON campeonatos_ganados.equipo_id = equipos.id
                   WHERE campeonatos_ganados.posicion = 'CAMPEON'
                   GROUP BY equipos.club_id
               )
           )"""
    ).fetchall()
    club_con_mas_titulos = [dict(fila) for fila in filas_titulos]

    # Traspaso más caro registrado (el "top 1" de /mercado-pases).
    fila_traspaso = db.execute(
        """SELECT
               jugadores.nombre, jugadores.apellido, contratos.precio_traspaso
           FROM contratos
           JOIN jugadores ON contratos.jugador_id = jugadores.id
           WHERE contratos.precio_traspaso IS NOT NULL
           ORDER BY contratos.precio_traspaso DESC
           LIMIT 1"""
    ).fetchone()
    traspaso_mas_caro = dict(fila_traspaso) if fila_traspaso else None

    return jsonify(
        {
            **totales,
            "total_goles_anotados": total_goles,
            "promedio_goles_por_partido": promedio_goles_por_partido,
            "club_con_mas_titulos": club_con_mas_titulos,
            "traspaso_mas_caro": traspaso_mas_caro,
            "nota": (
                "No se incluye 'goleador por torneo' porque el dataset no "
                "registra goles individuales por jugador, solo el marcador "
                "global de cada partido."
            ),
        }
    ), 200
