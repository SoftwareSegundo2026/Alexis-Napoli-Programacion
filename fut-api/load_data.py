"""
load_data.py — Script de carga de datos para Fut-API.

Qué hace:
  1. Borra la base SQLite anterior si existe (ver nota de diseño abajo).
  2. Crea la base desde cero ejecutando database/schema.sql.
  3. Lee los 12 JSON de data/ y hace INSERT en el orden correcto
     (tablas "padre" antes que tablas "hijo", para no violar FKs).

Cómo se ejecuta:
    python load_data.py
"""

import json
import os
import sqlite3

# ------------------------------------------------------------------
# Rutas: usamos rutas relativas al propio archivo, así el script
# funciona sin importar desde qué carpeta lo ejecutes.
# ------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(BASE_DIR, "database", "futbol.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "database", "schema.sql")


def leer_json(nombre_archivo):
    """Lee un archivo JSON de data/ y devuelve la lista de registros (dicts)."""
    ruta = os.path.join(DATA_DIR, nombre_archivo)
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def crear_conexion():
    """
    Abre una conexión a SQLite con las foreign keys activadas.
    IMPORTANTE: SQLite trae las FKs desactivadas por defecto por motivos
    históricos de compatibilidad. Sin esta línea, insertar un pais_id
    inexistente no daría ningún error.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def resetear_base():
    """Borra la base anterior (si existe) y la recrea ejecutando schema.sql."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print(f"Base anterior eliminada: {DB_PATH}")

    conn = crear_conexion()
    with open(SCHEMA_PATH, encoding="utf-8") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)  # executescript corre múltiples sentencias separadas por ';'
    conn.commit()
    print("Esquema creado desde schema.sql")
    return conn


# ------------------------------------------------------------------
# Funciones de carga, una por tabla.
# Se llaman en orden de dependencias: padres antes que hijos.
# Todas usan parámetros (?) en vez de f-strings, para evitar SQL injection
# y para que sqlite3 convierta automáticamente None -> NULL.
# ------------------------------------------------------------------

def cargar_paises(conn):
    registros = leer_json("paises.json")
    conn.executemany(
        "INSERT INTO paises (id, nombre, codigo_iso) VALUES (?, ?, ?)",
        [(r["id"], r["nombre"], r["codigo_iso"]) for r in registros],
    )
    print(f"paises: {len(registros)} registros cargados")


def cargar_provincias(conn):
    registros = leer_json("provincias.json")
    conn.executemany(
        "INSERT INTO provincias (id, nombre, pais_id) VALUES (?, ?, ?)",
        [(r["id"], r["nombre"], r["pais_id"]) for r in registros],
    )
    print(f"provincias: {len(registros)} registros cargados")


def cargar_ciudades(conn):
    registros = leer_json("ciudades.json")
    conn.executemany(
        "INSERT INTO ciudades (id, nombre, provincia_id) VALUES (?, ?, ?)",
        [(r["id"], r["nombre"], r["provincia_id"]) for r in registros],
    )
    print(f"ciudades: {len(registros)} registros cargados")


def cargar_clubes(conn):
    registros = leer_json("clubes.json")
    conn.executemany(
        """INSERT INTO clubes (id, nombre, ciudad_id, fundacion, estadio, capacidad)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (r["id"], r["nombre"], r["ciudad_id"], r["fundacion"], r["estadio"], r["capacidad"])
            for r in registros
        ],
    )
    print(f"clubes: {len(registros)} registros cargados")


def cargar_ligas(conn):
    registros = leer_json("ligas.json")
    conn.executemany(
        """INSERT INTO ligas (id, nombre, pais_id, categoria, tipo)
           VALUES (?, ?, ?, ?, ?)""",
        [(r["id"], r["nombre"], r["pais_id"], r["categoria"], r["tipo"]) for r in registros],
    )
    print(f"ligas: {len(registros)} registros cargados")


def cargar_temporadas(conn):
    registros = leer_json("temporadas.json")
    conn.executemany(
        "INSERT INTO temporadas (id, nombre) VALUES (?, ?)",
        [(r["id"], r["nombre"]) for r in registros],
    )
    print(f"temporadas: {len(registros)} registros cargados")


def cargar_torneos(conn):
    registros = leer_json("torneos.json")
    # fecha_fin puede venir como null en el JSON -> Python None -> SQL NULL.
    # No hace falta ningún manejo especial: sqlite3 lo convierte solo.
    conn.executemany(
        """INSERT INTO torneos (id, nombre, liga_id, temporada_id, fecha_inicio, fecha_fin)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (r["id"], r["nombre"], r["liga_id"], r["temporada_id"], r["fecha_inicio"], r["fecha_fin"])
            for r in registros
        ],
    )
    print(f"torneos: {len(registros)} registros cargados")


def cargar_equipos(conn):
    registros = leer_json("equipos.json")
    # grupo puede ser null (torneos sin fase de grupos).
    conn.executemany(
        "INSERT INTO equipos (id, club_id, torneo_id, grupo) VALUES (?, ?, ?, ?)",
        [(r["id"], r["club_id"], r["torneo_id"], r["grupo"]) for r in registros],
    )
    print(f"equipos: {len(registros)} registros cargados")


def cargar_jugadores(conn):
    registros = leer_json("jugadores.json")
    conn.executemany(
        """INSERT INTO jugadores (id, nombre, apellido, fecha_nacimiento, nacionalidad_id, posicion)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (r["id"], r["nombre"], r["apellido"], r["fecha_nacimiento"], r["nacionalidad_id"], r["posicion"])
            for r in registros
        ],
    )
    print(f"jugadores: {len(registros)} registros cargados")


def cargar_contratos(conn):
    registros = leer_json("contratos.json")
    # fecha_fin=null significa "jugador activo en ese equipo" (regla de negocio del enunciado).
    # precio_traspaso=null significa "sin traspaso" (ej: jugador formado en el club).
    conn.executemany(
        """INSERT INTO contratos (id, jugador_id, equipo_id, fecha_inicio, fecha_fin, precio_traspaso)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (
                r["id"],
                r["jugador_id"],
                r["equipo_id"],
                r["fecha_inicio"],
                r["fecha_fin"],
                r["precio_traspaso"],
            )
            for r in registros
        ],
    )
    print(f"contratos: {len(registros)} registros cargados")


def cargar_partidos(conn):
    registros = leer_json("partidos.json")
    conn.executemany(
        """INSERT INTO partidos
           (id, torneo_id, equipo_local_id, equipo_visitante_id, fecha, goles_local, goles_visitante)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        [
            (
                r["id"],
                r["torneo_id"],
                r["equipo_local_id"],
                r["equipo_visitante_id"],
                r["fecha"],
                r["goles_local"],
                r["goles_visitante"],
            )
            for r in registros
        ],
    )
    print(f"partidos: {len(registros)} registros cargados")


def cargar_campeonatos_ganados(conn):
    registros = leer_json("campeonatos_ganados.json")
    conn.executemany(
        "INSERT INTO campeonatos_ganados (id, equipo_id, torneo_id, posicion) VALUES (?, ?, ?, ?)",
        [(r["id"], r["equipo_id"], r["torneo_id"], r["posicion"]) for r in registros],
    )
    print(f"campeonatos_ganados: {len(registros)} registros cargados")


def main():
    conn = resetear_base()
    try:
        # Orden estricto: cada tabla se carga después de todas las tablas
        # de las que depende (sus FKs).
        cargar_paises(conn)
        cargar_provincias(conn)
        cargar_ciudades(conn)
        cargar_clubes(conn)
        cargar_ligas(conn)
        cargar_temporadas(conn)
        cargar_torneos(conn)
        cargar_equipos(conn)
        cargar_jugadores(conn)
        cargar_contratos(conn)
        cargar_partidos(conn)
        cargar_campeonatos_ganados(conn)

        conn.commit()
        print("\n✅ Carga completa. Base generada en:", DB_PATH)

    except sqlite3.IntegrityError as e:
        # Si algún JSON tuviera una FK inválida, sqlite3 tira IntegrityError
        # porque activamos PRAGMA foreign_keys = ON. Hacemos rollback para
        # no dejar la base a medio cargar.
        conn.rollback()
        print(f"\n❌ Error de integridad al cargar datos: {e}")
        raise

    finally:
        conn.close()


if __name__ == "__main__":
    main()
