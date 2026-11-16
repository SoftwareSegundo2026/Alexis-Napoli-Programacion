# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- Fase del flujo: `001-chinook-nest` (TP-1) → implementando. **T1 y T2 hechas**; siguiente: T3 (clave de escritura).
- Specs activas: `specs/001-chinook-nest/` (TP-1) · `specs/000-ejemplo-chinook/` (referencia del docente)
- Tests: `pnpm test` 45 (9 archivos) y `pnpm test:e2e` 7 (3 archivos) en verde; lint y build en verde.

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

## Aprendizajes y errores a evitar
- `ConfigModule.forRoot({ validate })` valida al **importar** `app.module`, no en `init()`.
- `ConfigService.get` prioriza lo que devolvió `validate` sobre `process.env`.
- pnpm 12 bloquea scripts nativos: sin `allowBuilds` → `ERR_PNPM_IGNORED_BUILDS`.
- TypeORM reintenta 9 veces (27 s) si la base falla: `retryAttempts: 0` para SQLite local.
- El body-parser de Express corre **antes** que los guards: un JSON malformado da 400 aunque falte
  la clave. Para respetar 401 → 400 (spec) la clave tiene que verificarse antes del parser (T3).
- En PowerShell, pnpm escribe en stderr aunque salga bien: mirar `$LASTEXITCODE`.
- `test/app.e2e-spec.ts` (de la base) no pasa `prettier --check`; no se tocó.

## Próximos pasos
- T3: clave de escritura (ver aprendizaje del body-parser; propuesta al usuario antes de hacerla).
- Pendiente de T6: el andamio `albums` tiene 2 warnings de lint (parámetros sin usar).
