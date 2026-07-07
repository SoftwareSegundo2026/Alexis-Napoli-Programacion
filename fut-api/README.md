# Fut-API

API REST para una liga de fútbol, construida con Flask y SQLite. Expone datos de países, provincias, ciudades, clubes, ligas, torneos, equipos, jugadores, contratos, partidos y campeonatos ganados, con CRUD completo y una mini web de consulta.

> Este README documenta el proyecto ya construido. El enunciado original del trabajo práctico está en `ENUNCIADO.md`.

## Stack

- Python 3.11+
- Flask (blueprints + application factory)
- SQLite (`sqlite3`, librería estándar — sin ORM)
- Frontend: HTML + JS vanilla (sin frameworks)

## Instalación y ejecución

```bash
# 1. Crear y activar un entorno virtual (recomendado)
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Cargar los datos en SQLite (crea database/futbol.db desde cero)
python load_data.py

# 4. Levantar el servidor
python main.py
```

La API queda en `http://localhost:5000`. La mini web de consulta está en `http://localhost:5000/` (la sirve el propio Flask).

### Recargar los datos

`load_data.py` se puede correr las veces que haga falta. Cada corrida **borra `database/futbol.db` y la recrea desde cero** a partir de `database/schema.sql` y los JSON de `data/`. Esto significa que cualquier dato cargado a mano vía la API (POST desde Postman, etc.) se pierde al recargar — es el comportamiento esperado: los JSON son la fuente de verdad del dataset.

## Estructura del proyecto

```
fut-api/
├── ENUNCIADO.md             # enunciado original del TP
├── README.md                # este archivo
├── requirements.txt		 # dependencias
├── data/                    # los 12 JSON originales, sin modificar
├── database/
│   ├── schema.sql           # CREATE TABLE, FKs, CHECKs, índices
│   └── futbol.db            # generado por load_data.py (no versionar)
├── load_data.py             # script de carga, independiente y re-ejecutable
├── main.py                  # punto de entrada (arranca create_app())
├── app/
│   ├── __init__.py           # application factory, registra blueprints
│   ├── db.py                 # conexión SQLite centralizada (get_db/close_db)
│   ├── errors.py              # ApiError + manejadores 400/404/409/500
│   ├── validation.py          # helpers de validación compartidos por el CRUD
│   └── routes/                # un blueprint por recurso
│       ├── paises.py
│       ├── clubes.py
│       ├── jugadores.py
│       ├── ligas.py
│       ├── torneos.py
│       ├── partidos.py
│       ├── contratos.py
│       ├── equipos.py
│       ├── provincias.py
│       ├── ciudades.py
│       ├── extra.py           # /mercado-pases, /estadisticas
│       └── web.py             # sirve la mini web
├── static/                   # CSS y JS de la mini web
├── templates/                 # HTML de la mini web
└── test_smoke.py              # smoke test contra un servidor real (ver abajo)
```

## Endpoints

### Consulta (GET)

| Ruta                                 | Filtros / detalle                                                         |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `/paises` , `/paises/<id>`       | detalle con provincias                                                    |
| `/provincias`                      | `?pais_id=`                                                             |
| `/ciudades`                        | `?provincia_id=`                                                        |
| `/clubes` , `/clubes/<id>`       | ordenado por nombre; detalle con ciudad/provincia/país/equipos           |
| `/ligas` , `/ligas/<id>`         | `?pais_id=`; detalle con torneos                                        |
| `/torneos` , `/torneos/<id>`     | `?liga_id=`, `?temporada_id=`; detalle con tabla de posiciones        |
| `/torneos/<id>/tabla`              | tabla de posiciones standalone                                            |
| `/equipos` , `/equipos/<id>`     | `?club_id=`, `?torneo_id=`; detalle con jugadores activos             |
| `/equipos/<id>/partidos`           | partidos de un equipo (local o visitante)                                 |
| `/jugadores` , `/jugadores/<id>` | `?posicion=`, `?nacionalidad_id=`; detalle con historial de contratos |
| `/jugadores/<id>/trayectoria`      | solo el historial de contratos                                            |
| `/partidos`                        | `?torneo_id=`, `?equipo_id=`, `?fecha_desde=`, `?fecha_hasta=`    |
| `/contratos`                       | `?jugador_id=`, `?equipo_id=`, `?activo=`                           |
| `/mercado-pases`                   | traspasos ordenados por monto descendente                                 |
| `/estadisticas`                    | estadísticas generales (ver limitación abajo)                           |

### Administración (CRUD)

`POST` / `PUT` / `DELETE` sobre `/clubes`, `/jugadores`, `/partidos`, `/torneos`, `/equipos`, `/contratos`.

## Decisiones de diseño y asunciones

El enunciado dejaba varios puntos abiertos a interpretación. Estas son las decisiones que se tomaron, con su razón:

- **`equipos` sin `UNIQUE(club_id, torneo_id)`**: el dataset real trae un club inscripto dos veces al mismo torneo (en grupos distintos). Forzar esa restricción rompería la carga de datos.
- **`contratos` sin restricción de "un solo contrato activo por jugador"**: hay jugadores con dos contratos simultáneos con `fecha_fin = null` en el dataset real. `?activo=true` puede devolver más de un contrato para el mismo jugador — es un resultado válido, no un bug.
- **`PUT` es una actualización parcial** (tipo PATCH) en todos los recursos: solo se modifican los campos enviados en el body, el resto conserva su valor.
- **"Cancelar" un contrato** se hace con `PUT /contratos/<id>` seteando `fecha_fin`, no necesariamente con `DELETE` (que borra la fila). Ambas operaciones están disponibles; cuál usar depende de si querés conservar el historial.
- **Sistema de puntos de la tabla de posiciones**: 3 puntos por victoria, 1 por empate, 0 por derrota (no especificado en el enunciado, es el estándar del fútbol actual). Desempate: puntos → diferencia de gol → goles a favor.
- **`/estadisticas` no incluye "goleador por torneo"**: el dataset no registra goles individuales por jugador (`partidos` solo tiene el marcador global), así que ese dato no es calculable con la información disponible. Se documenta explícitamente en la respuesta del endpoint.
- **IDs preservados del JSON** (`INTEGER PRIMARY KEY` sin `AUTOINCREMENT`): los IDs de los JSON se cargan tal cual, sin remapear, porque ya son consistentes entre sí vía las FKs.

## Testing

```bash
# Terminal 1
python main.py    

# Terminal 2
python test_smoke.py
```

`test_smoke.py` le pega por HTTP real a todos los endpoints (GETs, filtros, CRUD completo con casos válidos e inválidos) y muestra un resumen `OK/fallidos`. Los casos de CRUD crean y borran sus propios datos de prueba; si alguno queda a mitad de camino por un error, correr `python load_data.py` resetea todo al estado original.
