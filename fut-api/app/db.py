"""
app/db.py — Manejo centralizado de la conexión a SQLite.

Usamos el objeto 'g' de Flask, que vive durante la duración de un solo
request: la primera vez que algo pide la conexión en un request, se abre;
si algo más la vuelve a pedir en el mismo request, se reutiliza la misma.
Al terminar el request, Flask llama automáticamente a close_db() gracias
a app.teardown_appcontext (registrado en create_app, ver __init__.py).

Esto evita que cada archivo de rutas tenga que abrir y cerrar su propia
conexión a mano, y evita fugas de conexiones si un endpoint falla a mitad
de camino.
"""

import os
import sqlite3

from flask import g

# Misma ruta que usa load_data.py, para que main.py y load_data.py
# apunten siempre a la misma base sin importar desde dónde se ejecuten.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "database", "futbol.db")


def get_db():
    """
    Devuelve la conexión SQLite del request actual, creándola si no existe.
    """
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        # row_factory = sqlite3.Row permite acceder a las columnas por nombre
        # (row["nombre"]) y convertir la fila a dict con dict(row), en vez de
        # tener que acordarte del orden de las columnas como con tuplas.
        g.db.row_factory = sqlite3.Row
        # Igual que en load_data.py: sin esto, SQLite no valida las FKs.
        g.db.execute("PRAGMA foreign_keys = ON;")
    return g.db


def close_db(exception=None):
    """Cierra la conexión del request actual, si es que se abrió una."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_app(app):
    """Registra close_db para que se ejecute automáticamente al final de cada request."""
    app.teardown_appcontext(close_db)
