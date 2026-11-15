# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- Fase del flujo: Fase 0 (arnés + base) cerrada. Siguiente: spec `001-chinook-nest` (TP-1).
- Specs activas: `specs/000-ejemplo-chinook/` (referencia del docente)
- Tests: `pnpm lint`, `pnpm build`, `pnpm test` (3) y `pnpm test:e2e` (1) en verde sobre la base.

## Decisiones (y por qué)
- 15/11 · Base: copia de `programacion/nestjs-music` (trae Vitest, ConfigModule, oxlint y ESM).
- 15/11 · Constitución: se adopta la del docente sin cambios (`docs/constitution.md`).
- 15/11 · Lint: `no-explicit-any` y `ban-ts-comment` en `error` (en la base estaba `off`,
  contradecía el principio 4 de la constitution).
- 15/11 · Skills `sdd` y `nestjs-esm` creadas en `.agents/skills/` (el arnés las nombraba pero no venían).
- 15/11 · Orden de TPs: 1 → 2 → 5 → 6 (camino mínimo) → 3 → 4 → 7. TP-8 no se hace (optativo;
  el Proyecto Integrador es el del grupo).

## Aprendizajes y errores a evitar
- (vacío por ahora)

## Próximos pasos
- `/sdd-spec 001-chinook-nest`: entrevista (máx. 5 preguntas) y spec en borrador.
