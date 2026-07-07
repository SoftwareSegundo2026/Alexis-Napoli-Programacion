"""
app/validation.py — Helpers de validación reutilizados por los blueprints CRUD.

Centralizamos acá lo que se repite en todos los POST/PUT de la API:
"""

from flask import request

from app.errors import ApiError


def obtener_body_json():
    """
    Devuelve el body JSON del request, o corta con 400 si no vino

    silent=True hace que Flask no dispare su propio manejo de error interno
    """
    data = request.get_json(silent=True)
    if data is None:
        raise ApiError("El body debe ser un JSON válido", 400)
    if not isinstance(data, dict):
        raise ApiError("El body debe ser un objeto JSON (ej: {\"campo\": \"valor\"})", 400)
    return data


def validar_campos_requeridos(data, campos):
    """
    Verifica que 'data' tenga todos los campos listados en 'campos' y que ninguno sea None.
    """
    faltantes = [campo for campo in campos if data.get(campo) is None]
    if faltantes:
        raise ApiError(f"Faltan campos obligatorios: {', '.join(faltantes)}", 400)


def validar_existe(db, tabla, id_valor, nombre_para_mensaje):
    """
    Verifica que exista una fila con ese id en 'tabla'.
    """
    fila = db.execute(f"SELECT 1 FROM {tabla} WHERE id = ?", (id_valor,)).fetchone()
    if fila is None:
        raise ApiError(f"No existe {nombre_para_mensaje} con id {id_valor}", 400)