# Tareas 006 — Integración continua con GitHub Actions (TP-6)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/006-ci/plan.md` (aprobado el 16/11)

Reglas: una tarea por vez; **5 gates** locales en verde (`pnpm lint && pnpm build && pnpm test
&& pnpm test:e2e && pnpm test:cov`, más `pnpm typecheck` desde T1); un commit `006-Tn: …`,
`[x]` acá y `MEMORY.md` actualizado. Después, **PARA**. Push siempre con OK del usuario.
T1–T2 van a `main` (antes de la regla); T3–T4 y el cierre, por rama + PR (RF-9).

- [x] **T1. Script `typecheck` y versión de pnpm.** RF-4, RNF-7
      `package.json`: `"typecheck": "tsc --noEmit -p tsconfig.json"` y
      `"packageManager": "pnpm@12.6.0"`. Sin dependencias nuevas.
      Hecho cuando: `pnpm typecheck` sale con 0; con un error de tipos temporal en un test
      sale con ≠ 0 (mutación, se revierte); `pnpm install --frozen-lockfile` sigue sin
      cambiar el lockfile; los 5 gates en verde.
      Estimación: 10 min · depende de: —

- [x] **T2. Workflow de CI.** RF-1–RF-4, RF-6–RF-8, RNF-1–RNF-4, RNF-6
      `.github/workflows/ci.yml` en la raíz, job `gates`, pasos según el plan, cada step
      comentado en español. Commit en `main` y push (con OK).
      Hecho cuando: la primera corrida en GitHub del push a `main` termina en **verde** con
      los 7 pasos de gates visibles por separado y el artefacto de cobertura publicado (link
      de la corrida en `MEMORY.md`); re-ejecutada, el log muestra la cache restaurada (caso 3)
      y "Set up job" muestra `Contents: read` (caso 9).
      Estimación: 25 min · depende de: T1

- [x] **T3. Protección de `main` y PR rojo de evidencia.** RF-5, RF-9 · casos 1, 4, 8
      Usuario (con guía): regla en `main` con "Require status checks" → `gates`, y "Do not
      allow bypassing the above settings". Claude: rama `tp-6-evidencia-rojo` con un test
      roto a propósito, push (con OK). Usuario: abre el PR, captura "Merging is blocked" y lo
      **cierra sin mergear**.
      Hecho cuando: el PR muestra el check `gates` en rojo en el paso `Unit tests`, los pasos
      siguientes sin correr, y "Merging is blocked"; la captura está guardada en
      `nestjs-tp/docs/evidencias/` (link del PR en `MEMORY.md`).
      Estimación: 20 min (+ tiempo del usuario) · depende de: T2

- [ ] **T4. Documentación por rama + PR.** RF-8, RNF-3 · caso 2
      Rama `tp-6-ci`: sección "Integración continua" en `nestjs-tp/README.md` (qué corre,
      cuándo, cómo leer un fallo, link y captura del PR rojo). PR que el usuario mergea.
      Hecho cuando: el PR (solo documentación) corre `gates` completo en verde y el usuario
      lo mergea; `main` en GitHub tiene la sección con la evidencia.
      Estimación: 15 min · depende de: T3

Después de T4: `validate.md` (VEREDICTO en la primera línea; RF/RNF/casos → evidencia;
búsqueda de secretos) en la misma rama o una nueva, por PR.
