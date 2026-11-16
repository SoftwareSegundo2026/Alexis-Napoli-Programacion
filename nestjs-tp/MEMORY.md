# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- Fase del flujo: `001-chinook-nest` (TP-1) → implementando. **T1–T6 hechas**; siguiente: T7 (pistas).
- Specs activas: `specs/001-chinook-nest/` (TP-1) · `specs/000-ejemplo-chinook/` (referencia del docente)
- Tests: `pnpm test` 118 (18 archivos) y `pnpm test:e2e` 80 (6 archivos) en verde; lint sin avisos; build verde.

## Decisiones (y por qué)
- 15/11 · Base `programacion/nestjs-music`; constitución del docente sin cambios; lint con
  `no-explicit-any` y `ban-ts-comment` en `error`; skills `sdd` y `nestjs-esm` creadas.
- 15/11 · Orden de TPs: 1 → 2 → 5 → 6 → 3 → 4 → 7. TP-8 no se hace (optativo).
- 16/11 · T1: `data/chinook.template.db` = copia exacta de `fastAPI-example/instance/Chinook.db`
  (trae `ImageUrl`, `User` y `Activity`). Base de trabajo `data/chinook.db` en `.gitignore`.
- 16/11 · T1: los e2e preparan su base en `test/setup-e2e.ts` (setupFile): copia en `os.tmpdir()`
  por archivo + `WRITE_API_KEY` de prueba, **antes** de importar `AppModule`.
- 16/11 · T1: `prepareDatabase` en archivo propio; `test/database.e2e-spec.ts` (RNF-4) agregado.
- 16/11 · T1: `pnpm-workspace.yaml` → `better-sqlite3: true`, `@scarf/scarf: false` (telemetría).
- 16/11 · T2: `RequestValidationPipe` = dos `ValidationPipe`: el **cuerpo** rechaza campos
  desconocidos (spec); la **query** los ignora (paridad con el original).
- 16/11 · T2: `skip`/`limit` solo aceptan enteros escritos en limpio (`"1e2"`, `"1.5"`, `""` → 400).
- 16/11 · T2: validación → un solo `detail` (primer error); 500 → "Internal Server Error" (el
  detalle va al log). Agregado `test/app-setup.e2e-spec.ts` (prefijo, 404 y JSON malformado).
- 16/11 · T3 (cambio de plan aprobado por Alexis): clave de escritura como **middleware** global
  registrado en `configureApp` (no guard), para que corra antes del body-parser → 401 antes que
  400 también con JSON malformado. Plan (decisión 5) y tasks actualizados. Header `X-API-Key`,
  comparación con `timingSafeEqual` sobre SHA-256; mensaje `Missing or invalid write key`.
- 16/11 · T4: **patrón de recurso** (copiar en T5–T7): entidad camelCase→PascalCase, repository
  (DAO, `find({skip,take,order})`), service (404/409), controller (`ParseIntPipe`, 204),
  DTOs create/update/response (`fromEntity`). PATCH usa `@IfPresent()` (no `@IsOptional`).
- 16/11 · T4: nombre único con `LOWER(TRIM(name)) = LOWER(:name)` excluyendo el propio id;
  conteo de referencias con SQL parametrizado sobre `Track`. Mensajes 409 en inglés, con la causa.
- 16/11 · T5: campos **opcionales** (`ImageUrl`) usan `@IsOptional()`: `null` quita el valor. Los
  **obligatorios** en PATCH usan `@IfPresent()`: `null` → 400.
- 16/11 · T6: andamio `albums` reemplazado; sus 2 tests "should be defined" se **conservaron**
  (ahora con mocks) y se sumaron tests reales. `ArtistName` vía `@ManyToOne` de solo lectura;
  el repository relee tras guardar. `ArtistsModule` exporta su repository para validar `ArtistId`.
- 16/11 · T6: id relacionado inexistente → 400 `"ArtistId N does not match any artist"`; se
  chequea DESPUÉS del 404 del propio álbum (primero existe lo pedido, después sus datos).

## Aprendizajes y errores a evitar
- `ConfigModule.forRoot({ validate })` valida al **importar** `app.module`, no en `init()`.
- `ConfigService.get` prioriza lo que devolvió `validate` sobre `process.env`.
- pnpm 12 bloquea scripts nativos: sin `allowBuilds` → `ERR_PNPM_IGNORED_BUILDS`.
- TypeORM reintenta 9 veces (27 s) si la base falla: `retryAttempts: 0` para SQLite local.
- El body-parser de Express corre **antes** que los guards: un JSON malformado da 400 aunque falte
  la clave. Lo registrado con `app.use()` antes de `init()` corre antes del parser (resuelto en T3).
- En PowerShell, pnpm escribe en stderr aunque salga bien: mirar `$LASTEXITCODE`.
- `test/app.e2e-spec.ts` (de la base) no pasa `prettier --check`; no se tocó.

## Próximos pasos
- T7: pistas (`AlbumTitle`, `GenreName`, `MediaTypeName`; MediaType/InvoiceLine/PlaylistTrack de
  solo lectura; 409 si está en facturas o playlists; `UnitPrice` numérico).
