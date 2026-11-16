VEREDICTO: APROBADO

# Validación 001 — Catálogo Chinook en NestJS (TP-1)

Fecha: 16/11/2026 · Rol: reviewer (solo lectura: no se modificó código durante la validación)
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `docs/constitution.md`, `git log`.

## Gates (ejecutados en esta validación)

| Gate | Comando | Resultado |
|---|---|---|
| Lint | `pnpm lint` | ✅ exit 0, 0 avisos |
| Build | `pnpm build` | ✅ exit 0 |
| Unit | `pnpm test` | ✅ 151/151 (21 archivos) |
| e2e | `pnpm test:e2e` | ✅ 168/168 (9 archivos) |

Ningún test omitido (`skip`/`only`/`todo`), ningún `any` ni `@ts-ignore` en `src/` ni en `test/`.

## Requisitos funcionales → tests → resultado

| RF | Qué exige | Tests que lo cubren | Resultado |
|---|---|---|---|
| RF-1 | Listado ordenado por id ascendente | `*.repository.spec.ts` › "pagina EN LA BASE … orden por id ascendente" (×4) · `genres.e2e` › "lista los géneros ordenados por id" · `artists.e2e`, `albums.e2e`, `tracks.e2e` › "lista … ordenad(o/a)s por id" | ✅ |
| RF-2 | `skip`/`limit`, defaults 0/100 | `pagination-query.dto.spec` › "sin parámetros usa skip=0 y limit=100", "convierte skip y limit", "extremos válidos" · `genres.e2e` › "respeta skip y limit", "skip mayor que el total → []" · `artists.e2e` › "la última página trae lo que queda" · `albums.e2e`/`tracks.e2e` › "100 por defecto" | ✅ |
| RF-3 | Por id → 200; inexistente → 404 `"<Recurso> not found"` | `*.service.spec` › "404 … not found" (×4) · e2e de los 4 recursos › "consulta por id" e "id inexistente → 404" (incluye id 0 y -1 en géneros) | ✅ |
| RF-4 | Álbum incluye `ArtistName` | `albums.controller.spec` › "incluido ArtistName" · `albums.repository.spec` › "trae el artista en la misma consulta" · `albums.e2e` › "lista … con ArtistName", "crea con 201 e incluye el ArtistName", "cambiar de artista actualiza ArtistName" | ✅ |
| RF-5 | Pista incluye `AlbumTitle`, `GenreName`, `MediaTypeName`; `null` si no hay relación | `track-dto.spec` › "incluye AlbumTitle, GenreName y MediaTypeName", "sin álbum ni género, esos campos valen null" · `tracks.e2e` › "consulta por id con los datos enriquecidos", "sin álbum ni género → … null", "AlbumId en null quita el álbum" | ✅ |
| RF-6 | Alta válida → 201 con id y derivados | `*.service.spec` › create · e2e › "crea con 201" (×4, con verificación de persistencia por GET) | ✅ |
| RF-7 | PATCH parcial → 200; inexistente → 404 | `*.service.spec` › "cambia solo los campos enviados", "404 si … no existe" · e2e › "cambia solo lo enviado y conserva el resto", "{} → 200 sin cambios", "id inexistente → 404" (×4) | ✅ |
| RF-8 | Baja → 204 sin cuerpo; inexistente → 404 | `*.service.spec` › remove · e2e › "… sin pistas/álbumes/referencias → 204 sin cuerpo; después 404" (×4) | ✅ |
| RF-9 | Reglas de datos → 400 que nombra el campo, sin persistir | `*-dto.spec` (tabla de reglas por recurso, null en PATCH, campos desconocidos) · `request-validation.pipe.spec` (trim, solo espacios, campo desconocido, un solo mensaje) · e2e › "cuerpo inválido … → 400 que nombra el campo y no guarda" · ids relacionados inexistentes → 400 (`albums`, `tracks`, alta y modificación) | ✅ |
| RF-10 | `skip`/`limit` inválidos, id no entero, JSON malformado → 400 | `pagination-query.dto.spec` › limit 0/101/abc/1.5/""/1e2, skip -1/abc/2.5 · `detail-exception.filter.spec` › "JSON malformado → 400" · `app-setup.e2e` › "JSON malformado responde 400" · `genres.e2e` › "paginación inválida" ×4, "id no entero (abc/1.5) → 400" | ✅ |
| RF-11 | Escrituras sin clave válida → 401; lecturas libres | `write-key.middleware.spec` (12 casos) · `security.e2e` › 12 rutas × sin clave / incorrecta / vacía (36), prioridad 401 antes que 400/404/409, lecturas libres (8) · `app-setup.e2e` › "JSON malformado SIN clave → 401". Verificado con mutación: sin el middleware fallan 43 de 57 casos de `security.e2e`. | ✅ |
| RF-12 | Borrar algo referenciado → 409 con la causa | `*.service.spec` › "409 si …" (géneros/pistas, artistas/álbumes, álbumes/pistas, pistas/facturas y playlists) · `tracks.repository.spec` › "cuenta facturas y playlists" · e2e › "→ 409 que explica la causa, y no se borra" (×4) · encadenados: artista/álbum y álbum/pista se liberan al borrar lo que los referencia | ✅ |
| RF-13 | Nombre repetido de OTRO artista/género → 409; el propio no | `genres.service.spec`, `artists.service.spec` › "409 si …", "excluyendo al propio" · `genres.e2e`/`artists.e2e` › nombre repetido con mayúsculas y espacios → 409, "su propio nombre → 200", "el nombre de OTRO → 409" | ✅ |
| RF-14 | Documentación interactiva con todas las rutas y la clave | `docs.e2e` › "/docs responde", "las 5 rutas de /x" ×4, "exactamente las 20 rutas", "declara … X-API-Key", "las escrituras exigen la clave y las lecturas no", "skip y limit", "campos del contrato" | ✅ |

## Requisitos no funcionales

| RNF | Tests / evidencia | Resultado |
|---|---|---|
| RNF-1 Paginación en la base | `*.repository.spec` › `find({ skip, take, order })` (×4) | ✅ |
| RNF-2 Sin datos internos | `security.e2e` › "solo traen campos del contrato" (×4) y "los errores solo traen detail" · `*-response.dto` vía `*-dto.spec` · `detail-exception.filter.spec` › "500 genérico, sin filtrar el mensaje interno" | ✅ |
| RNF-3 Secretos fuera del repo; sin clave no arranca | `env.validation.spec` (7 casos) · verificación manual: `node dist/main.js` sin clave → exit 1 con mensaje claro · `.env` en `.gitignore` y nunca commiteado | ✅ |
| RNF-4 Tests sobre copia descartable | `database.e2e` › "copia temporal y no sobre el template", "escribir desde la app no modifica el template" · `prepare-database.spec` (4 casos) · `test/setup-e2e.ts` | ✅ |

## Criterios de finalización (spec)

- [x] Cada RF tiene al menos un test automatizado que lo comprueba y pasa (tabla de arriba).
- [x] La documentación refleja las rutas reales (`docs.e2e`, generada desde los controllers).
- [x] Los 4 gates en verde.

## Proceso

| Verificación | Resultado |
|---|---|
| Fases en orden con aprobación | spec + clarify (`803728c`) → plan + tasks (`2d23416`) → T1…T9 |
| Un commit por tarea | T1 `9ddaa73` · T2 `68f977a` · T3 `cef3b87` · T4 `def1148` · T5 `d07fc11` · T6 `7f48407` · T7 `b4fa73c` · T8 `ad5dcb3` · T9 `b5cad32` |
| Tareas `[x]` con gates en verde | 9/9 |
| `MEMORY.md` actualizado por tarea | Sí: incluido en los 9 commits de tarea |
| Tests existentes conservados | Sí: los 2 "should be defined" del andamio `albums` siguen (T6) |
| Cambios de plan | Decisión 5 (guard → middleware), aprobada el 16/11 y registrada en `plan.md` y `tasks.md` |

## Constitución

| Principio | Observación |
|---|---|
| 1. La spec manda | Sin funcionalidades fuera de la spec. `GET /` ("Hello World!") es de la base y se conservó por decisión del plan. |
| 2. Los tests son la puerta | Gates en verde en cada tarea; tests escritos antes que el código (rojo verificado en T1–T8; T9 verificado por mutación). |
| 3. Capas | Controllers sin lógica ni SQL; reglas en services; TypeORM solo en repositories; entrada y salida por DTOs. |
| 4. TS estricto | Sin `any` ni `@ts-ignore`. Los `as` están en dobles de test (mocks) y uno en `request-validation.pipe.ts` que amplía `Promise<any>` a `Promise<unknown>` (no fuerza un tipo). |
| 5. Seguridad | `.env` fuera del repo; clave obligatoria; escrituras protegidas por defecto (middleware global); comparación en tiempo constante. |
| 6. Idioma | Código en inglés; comentarios, documentación y Swagger en español. Los `detail` de error están en inglés por la paridad con el servicio original (RF-3 fija `"Album not found"`; decisión 2 de la entrevista). |

## Observaciones (no bloquean)

1. **Concurrencia (caso límite de la spec):** "dos modificaciones simultáneas → queda la última"
   no tiene un test dedicado. Es el comportamiento por defecto (no hay bloqueo) y el control de
   concurrencia está fuera de alcance (TP-4), donde conviene cubrirlo.
2. **RF-13 y acentos:** `LOWER()` de SQLite solo normaliza ASCII ("Ópera" y "ópera" no se
   detectan como repetidos). Riesgo aceptado y documentado en `plan.md`; hoy no hay datos así.
3. **Bases temporales:** si un e2e falla al levantar la app, su copia puede quedar en el
   directorio temporal del sistema (Windows la bloquea). En corridas verdes no queda ninguna.
