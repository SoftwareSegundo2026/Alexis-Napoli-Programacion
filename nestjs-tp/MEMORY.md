# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- Fase del flujo: `001-chinook-nest` (TP-1) → implementando. **T1 hecha**; siguiente: T2 (núcleo HTTP común).
- Specs activas: `specs/001-chinook-nest/` (TP-1) · `specs/000-ejemplo-chinook/` (referencia del docente)
- Tests: `pnpm test` 17 (5 archivos) y `pnpm test:e2e` 4 (2 archivos) en verde; lint y build en verde.

## Decisiones (y por qué)
- 15/11 · Base: copia de `programacion/nestjs-music` (trae Vitest, ConfigModule, oxlint y ESM).
- 15/11 · Constitución: se adopta la del docente sin cambios (`docs/constitution.md`).
- 15/11 · Lint: `no-explicit-any` y `ban-ts-comment` en `error` (en la base estaba `off`,
  contradecía el principio 4 de la constitution).
- 15/11 · Skills `sdd` y `nestjs-esm` creadas en `.agents/skills/` (el arnés las nombraba pero no venían).
- 15/11 · Orden de TPs: 1 → 2 → 5 → 6 (camino mínimo) → 3 → 4 → 7. TP-8 no se hace (optativo;
  el Proyecto Integrador es el del grupo).
- 16/11 · T1: `data/chinook.template.db` = copia exacta de `fastAPI-example/instance/Chinook.db`
  (ya trae `ImageUrl`, `User` y `Activity`). La base de trabajo `data/chinook.db` está en `.gitignore`.
- 16/11 · T1: los e2e preparan su base en `test/setup-e2e.ts` (setupFile de Vitest): copia temporal
  en `os.tmpdir()` por archivo + `WRITE_API_KEY` de prueba, **antes** de importar `AppModule`.
- 16/11 · T1: `prepareDatabase` en archivo propio (`src/database/prepare-database.ts`) para testearlo
  sin TypeORM. Se agregó `test/database.e2e-spec.ts` (RNF-4) además de los e2e del plan.
- 16/11 · T1: `pnpm-workspace.yaml` → `better-sqlite3: true` y `@scarf/scarf: false` (telemetría de
  Swagger UI, no hace falta).

## Aprendizajes y errores a evitar
- `ConfigModule.forRoot({ validate })` valida al **importar** `app.module`, no al hacer `init()`:
  las variables de los tests se definen antes del import (por eso el setupFile).
- `ConfigService.get` prioriza lo que devolvió `validate` sobre `process.env`.
- pnpm 12 bloquea scripts nativos: sin `allowBuilds` falla con `ERR_PNPM_IGNORED_BUILDS`.
- TypeORM reintenta 9 veces (27 s) si la base falla: `retryAttempts: 0` para SQLite local.
- En PowerShell, pnpm escribe en stderr aunque salga bien: mirar `$LASTEXITCODE`, no el color.

## Próximos pasos
- `/sdd-implement 001-chinook-nest T2` (prefijo `/api/v1`, `ValidationPipe`, filtro `{"detail"}`, paginación).
- Pendiente de T6: el andamio `albums` tiene 2 warnings de lint (parámetros sin usar); se reemplaza ahí.
