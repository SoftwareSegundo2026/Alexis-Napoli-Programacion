"""
main.py — Punto de entrada de Fut-API.

Se ejecuta con: python main.py
"""

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
