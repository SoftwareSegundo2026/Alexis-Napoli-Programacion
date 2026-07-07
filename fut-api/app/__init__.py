"""
app/__init__.py — Application factory.

El patrón "application factory" (una función create_app() que arma y
devuelve la app, en vez de tener el objeto Flask() como variable global
en el módulo) es el estándar recomendado por la propia documentación de
Flask para proyectos con más de un archivo de rutas.
"""

import os

from flask import Flask

from app import db
from app.errors import register_error_handlers

RAIZ_PROYECTO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def create_app():
    app = Flask(
        __name__,
        template_folder=os.path.join(RAIZ_PROYECTO, "templates"),
        static_folder=os.path.join(RAIZ_PROYECTO, "static"),
    )

    # Registra el cierre automático de la conexión SQLite al final de cada request.
    db.init_app(app)

    # Registra los manejadores de error (ApiError, 404, 400, 500, IntegrityError).
    register_error_handlers(app)

    # --- Blueprints ---
    # A medida que agreguemos recursos (torneos, ligas, etc.) cada uno se
    # importa y se registra acá con dos líneas nuevas.
    from app.routes.paises import bp as paises_bp
    from app.routes.clubes import bp as clubes_bp
    from app.routes.jugadores import bp as jugadores_bp
    from app.routes.ligas import bp as ligas_bp
    from app.routes.torneos import bp as torneos_bp
    from app.routes.partidos import bp as partidos_bp
    from app.routes.contratos import bp as contratos_bp
    from app.routes.equipos import bp as equipos_bp
    from app.routes.extra import bp as extra_bp
    from app.routes.provincias import bp as provincias_bp
    from app.routes.ciudades import bp as ciudades_bp
    from app.routes.web import bp as web_bp

    app.register_blueprint(paises_bp)
    app.register_blueprint(clubes_bp)
    app.register_blueprint(jugadores_bp)
    app.register_blueprint(ligas_bp)
    app.register_blueprint(torneos_bp)
    app.register_blueprint(partidos_bp)
    app.register_blueprint(contratos_bp)
    app.register_blueprint(equipos_bp)
    app.register_blueprint(extra_bp)
    app.register_blueprint(provincias_bp)
    app.register_blueprint(ciudades_bp)
    app.register_blueprint(web_bp)

    return app