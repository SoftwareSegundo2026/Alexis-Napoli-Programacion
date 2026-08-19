# Informe de evaluación — Alexis Napoli

**Fecha:** 19/08/2026
**Proyecto:** `repos/Alexis-Napoli-Programacion/miprimerproyecto/miproyecto/`
**Consigna:** Crear una app «tareas» con nombre, descripción y fecha; cargar 3 tareas desde el admin y mostrarlas en la portada.

## Nota final: 10 / 10

## Criterios evaluados

| Criterio | Estado | Detalle |
|---|---|---|
| App «tareas» creada y registrada en `INSTALLED_APPS` | ✅ | App `tareas` correcta |
| Modelo con nombre, descripción, fecha | ✅ | `Tarea` con `name`, `description`, `date` (inicialmente `nombre/descripcion/fecha`, luego renombrados a inglés) |
| Registrado en el admin | ✅ | `@admin.register(Tarea)` con `list_display` |
| Tareas visibles en la portada (raíz `/`) | ✅ | `path('', include('tareas.urls'))` → lista de tareas |
| Template muestra los 3 campos | ✅ | `tareas/lista.html` muestra nombre, descripción y fecha, con estilos |
| 3 tareas cargadas (verificado en DB) | ✅ | **3 tareas verificadas** en `db.sqlite3` (TP Programacion, Comprar pan, Trabajar) |

## Tests de corroboración

- Archivo: `tareas/test_tarea_consigna.py`
- Resultado: **4/4 OK**.

## Observaciones

- Cumple todos los requisitos de la consigna, incluida la carga de 3 tareas (verificada en la base de datos).
- Implementó soft delete propio (`is_deleted`, `deleted_at`).
- Los campos fueron renombrados de español a inglés (migraciones `0001` → `0002`); funcionalmente correcto.

## Recomendaciones

- Ninguna relevante. Trabajo completo.
