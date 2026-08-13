
# Proyecto Django - App "tareas"

Aplicación web simple hecha con Django que permite gestionar tareas (nombre, descripción y fecha de creación), con soporte de **soft delete** (borrado lógico).

## Requisitos previos

- Python 3.10 o superior
- pip (viene incluido con Python)

## Cómo correr el proyecto

### 1. Clonar / descomprimir el proyecto

Ubicate dentro de la carpeta `miprimerproyecto`.

### 2. Crear y activar el entorno virtual

```bash
python -m venv venv
```

Activarlo:

- **Windows:**
  ```bash
  venv\Scripts\activate
  ```
- **Mac/Linux:**
  ```bash
  source venv/bin/activate
  ```

Vas a ver `(venv)` al inicio de la terminal cuando esté activo.

### 3. Instalar Django

```bash
pip install django
```

### 4. Ir a la carpeta del proyecto

```bash
cd miproyecto
```

(Ahí es donde está el archivo `manage.py`.)

### 5. Aplicar las migraciones

```bash
python manage.py migrate
```

Esto crea la base de datos (`db.sqlite3`) con las tablas necesarias, incluida la de `Tarea`.

### 6. (Opcional) Crear un usuario administrador

Si querés entrar al panel de administración para cargar o ver tareas:

```bash
python manage.py createsuperuser
```

Seguí las instrucciones (usuario, email y contraseña).

### 7. Levantar el servidor

```bash
python manage.py runserver
```

### 8. Abrir en el navegador

- **Página principal (lista de tareas):**
  http://127.0.0.1:8000/
- **Panel de administración:**
  http://127.0.0.1:8000/admin
  (usá el usuario creado en el paso 6)

## Estructura del modelo `Tarea`

| Campo           | Tipo          | Descripción                                      |
| --------------- | ------------- | ------------------------------------------------- |
| `name`        | CharField     | Nombre de la tarea                                |
| `description` | TextField     | Descripción de la tarea                          |
| `date`        | DateTimeField | Fecha de creación (se completa automáticamente) |
| `is_deleted`  | BooleanField  | Indica si la tarea fue borrada (soft delete)      |
| `deleted_at`  | DateTimeField | Fecha en que se borró (vacío si no fue borrada) |

## Soft delete

En lugar de eliminar una tarea de la base de datos, el modelo `Tarea` incluye un método `soft_delete()` que marca la tarea como borrada (`is_deleted = True`) y registra la fecha de borrado (`deleted_at`), sin eliminar el registro físicamente.

La vista principal (`tareas/views.py`) solo muestra las tareas activas, filtrando por `is_deleted=False`.

## Cargar tareas de ejemplo

Las tareas se cargan desde el panel de administración (`/admin`):

1. Iniciar sesión con el usuario administrador
2. Ir a **Tareas → Agregar tarea**
3. Completar **name** y **description** (la fecha se completa sola)
4. Guardar

Las tareas cargadas aparecen automáticamente en la página principal (`/`).
