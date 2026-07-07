"""
test_smoke.py — Smoke test manual de Fut-API.

Qué hace: le pega con HTTP real (no test client, HTTP posta) a todos los
endpoints que ya existen, contra un servidor Fut-API corriendo de verdad,
y te muestra un resumen PASS/FAIL. Sirve para que VOS verifiques que todo
anda en tu máquina, no solo que yo lo haya probado en mi entorno.

Cómo usarlo:
    1. En una terminal:   python main.py
    2. En otra terminal:  python test_smoke.py

Requiere la librería 'requests' (si no la tenés: pip install requests).
"""

import sys

import requests

BASE_URL = "http://localhost:5000"

# Cada caso es: (método, ruta, status esperado, descripción)
CASOS = [
    ("GET", "/paises", 200, "Listar países"),
    ("GET", "/paises/1", 200, "Detalle de país existente (con provincias)"),
    ("GET", "/paises/999", 404, "Detalle de país inexistente"),
    ("GET", "/clubes", 200, "Listar clubes (ordenados por nombre)"),
    ("GET", "/clubes/1", 200, "Detalle de club (con ciudad/provincia/país/equipos)"),
    ("GET", "/clubes/999", 404, "Detalle de club inexistente"),
    ("GET", "/jugadores", 200, "Listar jugadores"),
    ("GET", "/jugadores?posicion=DEL", 200, "Jugadores filtrados por posición"),
    ("GET", "/jugadores?nacionalidad_id=2", 200, "Jugadores filtrados por nacionalidad"),
    ("GET", "/jugadores/3", 200, "Detalle de jugador (con historial de contratos)"),
    ("GET", "/jugadores/999", 404, "Detalle de jugador inexistente"),
    ("GET", "/ligas", 200, "Listar ligas"),
    ("GET", "/ligas?pais_id=1", 200, "Listar ligas filtradas por país"),
    ("GET", "/ligas/1", 200, "Detalle de liga (con torneos)"),
    ("GET", "/ligas/999", 404, "Detalle de liga inexistente"),
    ("GET", "/torneos", 200, "Listar torneos"),
    ("GET", "/torneos?liga_id=1", 200, "Listar torneos filtrados por liga"),
    ("GET", "/torneos?temporada_id=1", 200, "Listar torneos filtrados por temporada"),
    ("GET", "/torneos/1", 200, "Detalle de torneo (con tabla de posiciones)"),
    ("GET", "/torneos/1/tabla", 200, "Tabla de posiciones standalone"),
    ("GET", "/torneos/999", 404, "Detalle de torneo inexistente"),
    ("GET", "/partidos", 200, "Listar partidos"),
    ("GET", "/partidos?torneo_id=1", 200, "Partidos filtrados por torneo"),
    ("GET", "/partidos?equipo_id=1", 200, "Partidos filtrados por equipo (local o visitante)"),
    ("GET", "/partidos?fecha_desde=2023-01-01&fecha_hasta=2023-12-31", 200, "Partidos filtrados por rango de fechas"),
    ("GET", "/contratos", 200, "Listar contratos"),
    ("GET", "/contratos?jugador_id=3", 200, "Contratos filtrados por jugador"),
    ("GET", "/contratos?activo=true", 200, "Contratos filtrados por activos"),
    ("GET", "/equipos", 200, "Listar equipos"),
    ("GET", "/equipos?club_id=1", 200, "Equipos filtrados por club"),
    ("GET", "/equipos?torneo_id=8", 200, "Equipos filtrados por torneo"),
    ("GET", "/equipos/21", 200, "Detalle de equipo (con jugadores activos)"),
    ("GET", "/equipos/999", 404, "Detalle de equipo inexistente"),
    ("GET", "/equipos/21/partidos", 200, "Partidos de un equipo puntual"),
    ("GET", "/jugadores/3/trayectoria", 200, "Trayectoria de un jugador (historial de contratos)"),
    ("GET", "/jugadores/999/trayectoria", 404, "Trayectoria de jugador inexistente"),
    ("GET", "/mercado-pases", 200, "Traspasos ordenados por monto descendente"),
    ("GET", "/estadisticas", 200, "Estadísticas generales del dataset"),
    ("GET", "/provincias", 200, "Listar provincias"),
    ("GET", "/provincias?pais_id=1", 200, "Provincias filtradas por país"),
    ("GET", "/ciudades", 200, "Listar ciudades"),
    ("GET", "/ciudades?provincia_id=1", 200, "Ciudades filtradas por provincia"),
    ("GET", "/", 200, "Mini web: página principal"),
    ("GET", "/static/style.css", 200, "Mini web: hoja de estilos"),
    ("GET", "/static/app.js", 200, "Mini web: script principal"),
    ("GET", "/ruta-que-no-existe", 404, "Ruta inexistente (404 genérico)"),
]


def probar_crud(nombre, resultado):
    """Imprime el resultado de un caso de CRUD y devuelve 1 si pasó, 0 si no."""
    if resultado:
        print(f"✅ {nombre}")
        return 1
    else:
        print(f"❌ {nombre}")
        return 0


def probar_crud_clubes():
    """
    Prueba el ciclo de vida completo de clubes: crear, validar errores,
    actualizar, y las dos ramas del borrado (bloqueado y permitido).
    Se auto-limpia: el club de prueba que crea lo borra al final, así no
    deja basura en tu base de datos.
    """
    print("\n--- CRUD clubes ---")
    ok = 0
    total = 0

    r = requests.post(f"{BASE_URL}/clubes", json={"nombre": "Club Smoke Test", "ciudad_id": 1})
    total += 1
    ok += probar_crud("POST /clubes válido -> 201", r.status_code == 201)
    club_id = r.json().get("id") if r.status_code == 201 else None

    r = requests.post(f"{BASE_URL}/clubes", json={"nombre": "Sin ciudad"})
    total += 1
    ok += probar_crud("POST /clubes sin ciudad_id -> 400", r.status_code == 400)

    r = requests.post(f"{BASE_URL}/clubes", json={"nombre": "Test", "ciudad_id": 9999})
    total += 1
    ok += probar_crud("POST /clubes con ciudad_id inexistente -> 400", r.status_code == 400)

    r = requests.post(f"{BASE_URL}/clubes", json=[1, 2, 3])
    total += 1
    ok += probar_crud("POST /clubes con body de tipo incorrecto (lista) -> 400", r.status_code == 400)

    if club_id is not None:
        r = requests.put(f"{BASE_URL}/clubes/{club_id}", json={"capacidad": 12345})
        total += 1
        ok += probar_crud(
            "PUT /clubes/<id> actualiza solo el campo enviado -> 200",
            r.status_code == 200 and r.json().get("capacidad") == 12345,
        )

    r = requests.delete(f"{BASE_URL}/clubes/1")  # club 1 siempre tiene equipos en el dataset original
    total += 1
    ok += probar_crud("DELETE /clubes/1 (tiene equipos asociados) -> 409", r.status_code == 409)

    if club_id is not None:
        r = requests.delete(f"{BASE_URL}/clubes/{club_id}")
        total += 1
        ok += probar_crud("DELETE /clubes/<id> del club de prueba -> 204", r.status_code == 204)

    return ok, total


def probar_crud_jugadores():
    """Mismo criterio que clubes, aplicado a jugadores."""
    print("\n--- CRUD jugadores ---")
    ok = 0
    total = 0

    r = requests.post(
        f"{BASE_URL}/jugadores",
        json={
            "nombre": "Smoke",
            "apellido": "Test",
            "fecha_nacimiento": "2000-01-01",
            "nacionalidad_id": 1,
            "posicion": "DEL",
        },
    )
    total += 1
    ok += probar_crud("POST /jugadores válido -> 201", r.status_code == 201)
    jugador_id = r.json().get("id") if r.status_code == 201 else None

    r = requests.post(
        f"{BASE_URL}/jugadores",
        json={
            "nombre": "Test",
            "apellido": "Malo",
            "fecha_nacimiento": "2000-01-01",
            "nacionalidad_id": 1,
            "posicion": "PIVOTE",  # posición inválida a propósito
        },
    )
    total += 1
    ok += probar_crud("POST /jugadores con posicion inválida -> 400", r.status_code == 400)

    r = requests.delete(f"{BASE_URL}/jugadores/3")  # jugador 3 siempre tiene contratos en el dataset original
    total += 1
    ok += probar_crud("DELETE /jugadores/3 (tiene contratos) -> 409", r.status_code == 409)

    if jugador_id is not None:
        r = requests.delete(f"{BASE_URL}/jugadores/{jugador_id}")
        total += 1
        ok += probar_crud("DELETE /jugadores/<id> del jugador de prueba -> 204", r.status_code == 204)

    return ok, total


def probar_crud_partidos():
    """Mismo criterio, aplicado a partidos (incluye la regla local != visitante)."""
    print("\n--- CRUD partidos ---")
    ok = 0
    total = 0

    r = requests.post(
        f"{BASE_URL}/partidos",
        json={
            "torneo_id": 1,
            "equipo_local_id": 1,
            "equipo_visitante_id": 2,
            "fecha": "2023-05-01",
            "goles_local": 3,
            "goles_visitante": 2,
        },
    )
    total += 1
    ok += probar_crud("POST /partidos válido -> 201", r.status_code == 201)
    partido_id = r.json().get("id") if r.status_code == 201 else None

    r = requests.post(
        f"{BASE_URL}/partidos",
        json={
            "torneo_id": 1,
            "equipo_local_id": 1,
            "equipo_visitante_id": 1,  # mismo equipo a propósito
            "fecha": "2023-05-01",
            "goles_local": 1,
            "goles_visitante": 1,
        },
    )
    total += 1
    ok += probar_crud("POST /partidos con local == visitante -> 400", r.status_code == 400)

    if partido_id is not None:
        r = requests.delete(f"{BASE_URL}/partidos/{partido_id}")
        total += 1
        ok += probar_crud("DELETE /partidos/<id> del partido de prueba -> 204", r.status_code == 204)

    return ok, total


def probar_crud_torneos():
    """Mismo criterio, aplicado a torneos."""
    print("\n--- CRUD torneos ---")
    ok = 0
    total = 0

    r = requests.post(
        f"{BASE_URL}/torneos",
        json={"nombre": "Torneo Smoke Test", "liga_id": 1, "temporada_id": 3, "fecha_inicio": "2026-01-01"},
    )
    total += 1
    ok += probar_crud("POST /torneos válido (sin fecha_fin) -> 201", r.status_code == 201)
    torneo_id = r.json().get("id") if r.status_code == 201 else None

    r = requests.delete(f"{BASE_URL}/torneos/1")  # torneo 1 siempre tiene equipos en el dataset original
    total += 1
    ok += probar_crud("DELETE /torneos/1 (tiene equipos inscriptos) -> 409", r.status_code == 409)

    if torneo_id is not None:
        r = requests.delete(f"{BASE_URL}/torneos/{torneo_id}")
        total += 1
        ok += probar_crud("DELETE /torneos/<id> del torneo de prueba -> 204", r.status_code == 204)

    return ok, total


def probar_crud_equipos():
    """Mismo criterio que los otros CRUD, aplicado a equipos."""
    print("\n--- CRUD equipos ---")
    ok = 0
    total = 0

    r = requests.post(f"{BASE_URL}/equipos", json={"club_id": 1, "torneo_id": 3, "grupo": "X"})
    total += 1
    ok += probar_crud("POST /equipos válido -> 201", r.status_code == 201)
    equipo_id = r.json().get("id") if r.status_code == 201 else None

    r = requests.delete(f"{BASE_URL}/equipos/1")  # equipo 1 siempre tiene partidos en el dataset original
    total += 1
    ok += probar_crud("DELETE /equipos/1 (tiene partidos/contratos) -> 409", r.status_code == 409)

    if equipo_id is not None:
        r = requests.delete(f"{BASE_URL}/equipos/{equipo_id}")
        total += 1
        ok += probar_crud("DELETE /equipos/<id> del equipo de prueba -> 204", r.status_code == 204)

    return ok, total


def probar_crud_contratos():
    """
    Prueba el ciclo completo de contratos, incluyendo el caso especial de
    'cancelación' vía PUT con fecha_fin (en vez de DELETE).
    """
    print("\n--- CRUD contratos ---")
    ok = 0
    total = 0

    r = requests.post(
        f"{BASE_URL}/contratos",
        json={"jugador_id": 1, "equipo_id": 1, "fecha_inicio": "2026-01-01"},
    )
    total += 1
    ok += probar_crud(
        "POST /contratos válido, sin fecha_fin -> 201 y queda activo",
        r.status_code == 201 and r.json().get("fecha_fin") is None,
    )
    contrato_id = r.json().get("id") if r.status_code == 201 else None

    if contrato_id is not None:
        r = requests.put(f"{BASE_URL}/contratos/{contrato_id}", json={"fecha_fin": "2026-07-05"})
        total += 1
        ok += probar_crud(
            "PUT /contratos/<id> cancela seteando fecha_fin -> 200",
            r.status_code == 200 and r.json().get("fecha_fin") == "2026-07-05",
        )

        r = requests.delete(f"{BASE_URL}/contratos/{contrato_id}")
        total += 1
        ok += probar_crud("DELETE /contratos/<id> del contrato de prueba -> 204", r.status_code == 204)

    return ok, total


def main():
    print(f"Probando Fut-API en {BASE_URL}\n")

    try:
        requests.get(BASE_URL, timeout=2)
    except requests.exceptions.ConnectionError:
        print("❌ No se pudo conectar al servidor.")
        print("   ¿Corriste 'python main.py' en otra terminal primero?")
        sys.exit(1)

    exitosos = 0
    fallidos = 0

    for metodo, ruta, status_esperado, descripcion in CASOS:
        url = BASE_URL + ruta
        try:
            respuesta = requests.request(metodo, url, timeout=5)
        except requests.exceptions.RequestException as e:
            print(f"❌ {metodo} {ruta} -> ERROR DE CONEXIÓN ({e})")
            fallidos += 1
            continue

        if respuesta.status_code == status_esperado:
            print(f"✅ {metodo} {ruta} -> {respuesta.status_code} ({descripcion})")
            exitosos += 1
        else:
            print(
                f"❌ {metodo} {ruta} -> esperaba {status_esperado}, "
                f"recibió {respuesta.status_code} ({descripcion})"
            )
            print(f"   respuesta: {respuesta.text[:200]}")
            fallidos += 1

    # --- Casos de CRUD (crean y borran sus propios datos de prueba) ---
    for funcion_crud in (
        probar_crud_clubes,
        probar_crud_jugadores,
        probar_crud_partidos,
        probar_crud_torneos,
        probar_crud_equipos,
        probar_crud_contratos,
    ):
        ok, total = funcion_crud()
        exitosos += ok
        fallidos += total - ok

    total_casos = exitosos + fallidos
    print(f"\n{'='*50}")
    print(f"Resultado: {exitosos} OK / {fallidos} fallidos de {total_casos} casos")
    print("\nNota: si algún caso de CRUD falló a mitad de camino, puede haber")
    print("quedado algún registro de prueba en tu base. Corré 'python load_data.py'")
    print("para resetear todo al estado original antes de seguir.")
    if fallidos > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()