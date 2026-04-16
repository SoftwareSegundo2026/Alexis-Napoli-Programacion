# FastAPI Albums - Documentación

---

## Resumen del Proyecto

Este proyecto implementa un **CRUD completo para la tabla Albums** en una aplicación FastAPI, integrada con la base de datos **Chinook.db**.

Se siguió una arquitectura de **capas** respetando la estructura existente del proyecto:

- **Models**: Definiciones SQLAlchemy
- **Schemas**: Validaciones Pydantic
- **Repositories**: Acceso a datos (CRUD genérico)
- **Services**: Lógica de negocio
- **Endpoints**: Rutas REST

---

## Qué se Implementó

### Archivos Creados:

| Archivo                                  | Descripción                                   |
| ---------------------------------------- | ---------------------------------------------- |
| `app/models/album.py`                  | Modelo ORM para la tabla Album                 |
| `app/schemas/album.py`                 | Schemas Pydantic (Create, Update, Read)        |
| `app/repositories/album_repository.py` | Repositorio con métodos específicos de Album |
| `app/services/album_service.py`        | Lógica de negocio y validaciones              |
| `app/api/v1/endpoints/albums.py`       | 6 endpoints REST funcionales                   |
| `models_all/__init__.py`               | Paquete Python para modelos                    |

### Archivos Modificados:

| Archivo                                   | Cambios                               |
| ----------------------------------------- | ------------------------------------- |
| `app/api/v1/router.py`                  | Registrado router de albums           |
| `app/models/artist.py`                  | Limpieza de imports                   |
| `app/repositories/artist_repository.py` | Agregado import de select             |
| `models-all/` → `models_all/`        | Renombrado directorio (Python naming) |

### Features Implementados:

 **CRUD Completo**

- Create (POST) - Crear nuevo album
- Read (GET) - Obtener albums por ID o listar todos
- Update (PATCH) - Actualizar album
- Delete (DELETE) - Eliminar album

 **Relaciones Correctas**

- Album ↔ Artist (muchos albums por artista)
- Album ↔ Track (album contiene muchas tracks)
- Validación de Artist existente antes de crear

 **Características**

- Paginación en listados (skip/limit)
- Validaciones de datos con Pydantic
- Manejo de errores HTTP apropiados
- Async/await completo
- Integración con BD Chinook.db

---

## Estructura del Proyecto

```
fastAPI-example/
│
├── app/
│   ├── models/
│   │   ├── __init__.py
│   │   ├── artist.py          ← Modelo Artist
│   │   └── album.py           ← [NUEVO] Modelo Album
│   │
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── artist.py
│   │   └── album.py           ← [NUEVO] Schemas Album
│   │
│   ├── repositories/
│   │   ├── __init__.py
│   │   ├── base_repository.py
│   │   ├── artist_repository.py
│   │   └── album_repository.py ← [NUEVO] Repositorio Album
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── artist_service.py
│   │   └── album_service.py   ← [NUEVO] Servicio Album
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── dependencies.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py       ← [MODIFICADO] Registra albums
│   │       └── endpoints/
│   │           ├── __init__.py
│   │           ├── artists.py
│   │           └── albums.py   ← [NUEVO] Endpoints Album
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── database.py
│   │   └── security.py
│   │
│   ├── __init__.py
│   └── main.py
│
├── models_all/                 ← [RENOMBRADO de models-all]
│   ├── __init__.py            ← [NUEVO]
│   └── models.py              ← Definiciones de todas las tablas
│
├── instance/
│   └── Chinook.db             ← Base de datos SQLite
│
├── .venv/                      ← Entorno virtual Python
├── main.py                     ← Punto de entrada
├── pyproject.toml              ← Dependencias del proyecto
└── README.md                   ← Este archivo
```

---

## Primeros Pasos

### Requisitos Previos

- Python 3.8+
- `pip` o `uv`

### Instalación

**1. Clonar el repositorio y navegar a la carpeta del proyecto:**

```bash
cd fastAPI-example
```

**2. Activar el entorno virtual:**

```bash
# PowerShell
.\.venv\Scripts\Activate.ps1

# CMD
.\.venv\Scripts\activate.bat

# Linux / macOS
source .venv/bin/activate
```

**3. Instalar dependencias:**

```bash
pip install -r requirements.txt
# o, usando uv:
uv pip install fastapi uvicorn sqlalchemy aiosqlite pydantic
```

**4. Iniciar el servidor de desarrollo:**

```bash
python run uvicorn main:app --reload
```

El servidor estará disponible en `http://127.0.0.1:8000`.

### Documentación Interactiva

| Interfaz   | URL                         |
| ---------- | --------------------------- |
| Swagger UI | http://localhost:8000/docs  |
| ReDoc      | http://localhost:8000/redoc |

---

## Cómo Usar el Sistema

### Usar Swagger UI (Interfaz Web)

1. Abre http://localhost:8000/docs en tu navegador
2. Expande la sección **albums**
3. Haz clic en cada endpoint
4. Rellena los parámetros requeridos
5. Haz clic en **Execute**

---

## Endpoints Disponibles

### 1. Crear Album

```http
POST /api/v1/albums/
Content-Type: application/json

{
  "Title": "The Wall",
  "ArtistId": 5
}
```

**Respuesta (201 Created):**

```json
{
  "AlbumId": 350,
  "Title": "The Wall",
  "ArtistId": 5
}
```

---

### 2. Obtener Todos los Albums

```http
GET /api/v1/albums/?skip=0&limit=10
```

**Respuesta (200 OK):**

```json
[
  {
    "AlbumId": 1,
    "Title": "For Those About To Rock We Salute You",
    "ArtistId": 1
  },
  {
    "AlbumId": 2,
    "Title": "Balls to the Wall",
    "ArtistId": 2
  },
  ...
]
```

**Parámetros:**

- `skip` (int): Número de registros a saltar (default: 0)
- `limit` (int): Número máximo de registros (default: 100)

---

### 3. Obtener Album por ID

```http
GET /api/v1/albums/5
```

**Respuesta (200 OK):**

```json
{
  "AlbumId": 5,
  "Title": "Jagged Little Pill",
  "ArtistId": 12
}
```

**Errores:**

- `404 Not Found`: Si el album no existe

---

### 4. Actualizar Album

```http
PATCH /api/v1/albums/5
Content-Type: application/json

{
  "Title": "Jagged Little Pill (Remastered)",
  "ArtistId": 12
}
```

**Respuesta (200 OK):**

```json
{
  "AlbumId": 5,
  "Title": "Jagged Little Pill (Remastered)",
  "ArtistId": 12
}
```

**Validaciones:**

- `Title` es opcional en actualización
- `ArtistId` debe existir en la tabla Artist
- Mínimo 1 carácter, máximo 160 caracteres

---

### 5. Eliminar Album

```http
DELETE /api/v1/albums/5
```

**Respuesta (204 No Content):**

- Sin cuerpo de respuesta

**Errores:**

- `404 Not Found`: Si el album no existe

---

### 6. Obtener Albums por Artista

```http
GET /api/v1/albums/artist/1
```

**Respuesta (200 OK):**

```json
[
  {
    "AlbumId": 1,
    "Title": "For Those About To Rock We Salute You",
    "ArtistId": 1
  },
  {
    "AlbumId": 4,
    "Title": "Let There Be Rock",
    "ArtistId": 1
  }
]
```

**Errores:**

- `404 Not Found`: Si no hay albums para ese artista

---

### 7. Obtener Tracks de un Album

```http
GET /api/v1/albums/1/tracks
```

**Respuesta (200 OK):**

```json
[
  {
    "TrackId": 1,
    "Name": "For Those About To Rock (We Salute You)",
    "AlbumId": 1,
    "MediaTypeId": 1,
    "GenreId": 1,
    "Composer": "Angus Young, Malcolm Young, Brian Johnson",
    "Milliseconds": 343719,
    "Bytes": 11170334,
    "UnitPrice": "0.99"
  },
  ...
]
```

---

## Validaciones y Errores

### Validaciones en Creación/Actualización

| Campo              | Regla                         | Ejemplo                    |
| ------------------ | ----------------------------- | -------------------------- |
| **Title**    | 1-160 caracteres, obligatorio | `"Black Sabbath"` ✓     |
| **ArtistId** | Debe existir en tabla Artist  | `ArtistId: 1` (AC/DC) ✓ |

### Códigos de Respuesta HTTP

| Código                             | Significado         | Cuándo                          |
| ----------------------------------- | ------------------- | -------------------------------- |
| **200 OK**                    | Éxito en GET/PATCH | Album encontrado y actualizado   |
| **201 Created**               | Éxito en POST      | Album creado exitosamente        |
| **204 No Content**            | Éxito en DELETE    | Album eliminado exitosamente     |
| **400 Bad Request**           | Error en datos      | ArtistId no existe, Title vacío |
| **404 Not Found**             | No existe           | Album, artista o ruta incorrecta |
| **500 Internal Server Error** | Error del servidor  | Error en base de datos           |

### Ejemplos de Errores

**ArtistId no existe:**

```bash
POST /api/v1/albums/
{
  "Title": "Album Fantasma",
  "ArtistId": 99999
}
```

**Respuesta (400):**

```json
{
  "detail": "Artist with ID 99999 not found"
}
```

---

**Album no existe:**

```bash
GET /api/v1/albums/99999
```

**Respuesta (404):**

```json
{
  "detail": "Album not found"
}
```

---

**Title vacío:**

```bash
POST /api/v1/albums/
{
  "Title": "",
  "ArtistId": 1
}
```

**Respuesta (400):**

```json
{
  "detail": "ensure this value has at least 1 characters"
}
```

---

## Recursos

- [Documentación de FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
- [Documentación de Pydantic](https://docs.pydantic.dev/)
- [Base de datos Chinook](https://github.com/lerocha/chinook-database)
