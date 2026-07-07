"""
app/errors.py — Manejo centralizado de errores HTTP.

Idea: en vez de que cada endpoint escriba a mano
    return jsonify({"error": "..."}), 404
en cada lugar donde algo puede salir mal, definimos una excepción propia
(ApiError) que cualquier endpoint puede "lanzar" con el mensaje y el código
HTTP que corresponda.
"""

import sqlite3

from flask import jsonify


class ApiError(Exception):
    def __init__(self, mensaje, status_code=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.status_code = status_code


def register_error_handlers(app):
    """Registra todos los manejadores de error de la app. Se llama desde create_app()."""

    @app.errorhandler(ApiError)
    def handle_api_error(error):
        # Errores de negocio que nosotros mismos lanzamos con raise ApiError(...)
        return jsonify({"error": error.mensaje}), error.status_code

    @app.errorhandler(404)
    def handle_not_found(error):
        # Se dispara cuando la URL no matchea ninguna ruta definida
        return jsonify({"error": "Recurso no encontrado"}), 404

    @app.errorhandler(400)
    def handle_bad_request(error):
        # Se dispara, por ejemplo, si Flask no puede parsear el JSON del body.
        return jsonify({"error": "Solicitud inválida"}), 400

    @app.errorhandler(sqlite3.IntegrityError)
    def handle_integrity_error(error):
        # Se dispara si, por ejemplo, un DELETE viola una FK con ON DELETE RESTRICT 
        return jsonify({"error": f"Conflicto de integridad de datos: {error}"}), 409

    @app.errorhandler(500)
    def handle_internal_error(error):
        return jsonify({"error": "Error interno del servidor"}), 500
