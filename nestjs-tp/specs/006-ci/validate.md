VEREDICTO: APROBADO

# Validación 006 — Integración continua con GitHub Actions (TP-6)

Fecha: 16/11/2026 · Rol: reviewer (solo lectura: no se modificó código durante la validación)
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `.github/workflows/ci.yml`,
`consignas/TP6-ci-github-actions.md`, `git log`, API pública de GitHub (el repo es público).

## Corridas en GitHub (verificables por cualquiera)

| Corrida | Evento | Resultado | Para qué |
|---|---|---|---|
| [43884819522](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/actions/runs/43884819522) | push a `main` (`7ab5890`) | ✅ 47 s, artefacto `cobertura` | Primera corrida; re-ejecutada (intento 2) para la cache |
| [43886334199](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/actions/runs/43886334199) | push a `main` (`fa7914e`) | ✅ 56 s | Último push directo, antes de la regla |
| [43891474309](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/actions/runs/43891474309) | PR #1 (test intencional) | ❌ en "Unit tests" | Evidencia del bloqueo |
| [43892800709](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/actions/runs/43892800709) | PR #2 (solo documentación) | ✅ 46 s, artefacto `cobertura` | Caso 2 y entrada de este TP por PR |

Gates locales en la rama `tp-6-ci`: lint ✅ (0 avisos) · build ✅ · 279 unit ✅ · 380 e2e ✅ ·
test:cov ✅ (76,88% / 81,77%) · typecheck ✅.

## Requisitos → evidencia → resultado

| RF | Qué exige | Evidencia | Resultado |
|---|---|---|---|
| RF-1 | PR hacia `main` dispara el pipeline | `on.pull_request.branches: [main]`; corridas de PR #1 y PR #2 | ✅ |
| RF-2 | Push a `main` dispara el pipeline | `on.push.branches: [main]`; corridas 43884819522 y 43886334199 | ✅ |
| RF-3 | Job `gates`, pasos separados en orden; si uno falla, los siguientes no corren | API de pasos: install → Lint → Build → Unit tests → E2E tests → Cobertura → Typecheck; en PR #1, "Unit tests" ❌ y los 4 siguientes `skipped` | ✅ |
| RF-4 | Mismos comandos que la constitución, todos scripts | `pnpm lint/build/test/test:e2e/test:cov/typecheck`; `typecheck` agregado a `package.json` (006-T1) | ✅ |
| RF-5 | Sin `gates` verde no se mergea; sin excepciones | API de `main`: `protected: true`, `contexts: ["gates"]`, `enforcement_level: "everyone"`; PR #1 con botón de merge deshabilitado siendo admin (captura); capturas de la regla | ✅ |
| RF-6 | Cache de pnpm | Re-ejecución de 43884819522: cache de 65 MB restaurada (último uso 14:26), guardado posterior 5 s → 0 s | ✅ |
| RF-7 | Artefacto de cobertura si el paso corrió; si no, sin error | Corridas verdes: artefacto `cobertura` (1869 bytes); PR #1: paso de cobertura `skipped` → sin artefacto y sin error extra | ✅ |
| RF-8 | Corre aunque sea solo documentación | Sin `paths:` en el YAML; PR #2 (README, specs, imágenes) corrió `gates` completo | ✅ |
| RF-9 | Desde la protección, todo por rama + PR | Último push directo `fa7914e` antes de la regla; después, PR #1 y PR #2 | ✅ |

## Requisitos no funcionales

| RNF | Evidencia | Resultado |
|---|---|---|
| RNF-1 — permisos de solo lectura | `permissions: contents: read`; log "Set up job": `Contents: read`, `Metadata: read` ([captura](../../docs/evidencias/006-permisos-token.png)) | ✅ |
| RNF-2 — sin secretos | Búsqueda en esta validación: el único `.env*` del historial es `.env.example` (valores vacíos); 0 coincidencias de claves privadas o tokens con formato conocido (GitHub, AWS, Slack, OpenAI) en TODO el historial; el workflow no usa `secrets.*`; los únicos valores asignados son de tests y se nombran como tales (`'secreto-de-prueba-e2e-no-usar-en-produccion'`) | ✅ |
| RNF-3 — YAML comentado en español | Cada job y cada step de `ci.yml` con comentario sobre qué valida | ✅ |
| RNF-4 — workflow en la raíz, trabaja en `nestjs-tp/` | `.github/workflows/ci.yml`; `defaults.run.working-directory: nestjs-tp` | ✅ |
| RNF-5 — suite en verde | Gates locales (arriba) y corridas verdes | ✅ |
| RNF-6 — 15 min y cancelación | `timeout-minutes: 15`; `concurrency` con `cancel-in-progress: true` (lectura del YAML) | ✅ |
| RNF-7 — misma versión de pnpm, Node 24 | `packageManager: pnpm@12.6.0` leído por `pnpm/action-setup`; `node-version: 24` | ✅ |

## Casos límite

| # | Situación | Evidencia | Resultado |
|---|---|---|---|
| 1 | PR con un test en rojo | PR #1: `gates` ❌, merge deshabilitado ([captura](../../docs/evidencias/006-pr-rojo-merge-bloqueado.png)) | ✅ |
| 2 | PR solo de documentación | PR #2 corrió el pipeline completo, en verde | ✅ |
| 3 | Segunda corrida con el mismo lockfile | Cache restaurada en la re-ejecución | ✅ |
| 4 | Un paso falla | PR #1: "Unit tests" ❌; E2E, cobertura y typecheck sin correr ([captura](../../docs/evidencias/006-pr-rojo-pasos.png)) | ✅ |
| 5 | Cobertura bajo el umbral | Paso `pnpm test:cov` (umbral del TP-5, mutaciones en `005/validate.md`); el artefacto se publica si el paso corrió (`steps.coverage.outcome != 'skipped'`) | ✅ (por configuración) |
| 6 | Lockfile desactualizado | `pnpm install --frozen-lockfile` (no lo modifica; falla si no coincide) | ✅ (por configuración) |
| 7 | PR desde un fork | Evento `pull_request` (no `pull_request_target`): sin secretos y token de solo lectura | ✅ (lectura del YAML) |
| 8 | Admin intenta mergear un PR rojo | Botón deshabilitado para el admin en PR #1; `enforcement_level: everyone` | ✅ |
| 9 | El workflow intenta escribir | Token con `Contents: read` (log) | ✅ |
| 10 | Un test se cuelga | `timeout-minutes: 15` | ✅ (por configuración) |
| 11 | Dos pushes seguidos | `concurrency` con `cancel-in-progress` | ✅ (por configuración) |

Los casos 5, 6, 10 y 11 no se forzaron en GitHub (plan 006: gastarían corridas sin aportar más
evidencia que la configuración, que es pública en el YAML).

## Consigna

- Workflow con `pull_request` y `push` a la rama principal, cache de pnpm, los 4 gates como pasos
  separados (más cobertura y tipos) y artefacto de cobertura. ✅
- Rama principal protegida con *required status check* y sin bypass. ✅ (repo hecho público:
  opción 2 de la consigna; en una org Free un repo privado devolvería 403).
- Sin credenciales en el workflow ni en el repo. ✅
- PR deliberadamente rojo que no pudo mergear, verificable por cualquiera: [PR #1](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/pull/1)
  y su corrida pública; capturas en `docs/evidencias/` y en `nestjs-tp/README.md`. ✅
- El pipeline corre los mismos comandos que la constitución. ✅
- YAML comentado en español. ✅

## Proceso

Fases aprobadas en orden por el usuario: spec + clarify (`e752207`; ronda 1 con 12 detecciones,
ronda 2 APROBADA) → plan y tareas (`a8b77f2`) → T1 `38929e8` · T2 `7ab5890` + cierre `fa7914e`
(en `main`, antes de la regla, según RF-9) → T3 `f877a06` · T4 `65c4931` (rama `tp-6-ci`,
PR #2). `MEMORY.md` actualizado en cada tarea.

## Observaciones (no bloquean)

1. La interfaz actual de GitHub ya no muestra el texto "Merging is blocked": muestra el check
   requerido fallido y el botón de merge deshabilitado. La API sin autenticación informa
   `mergeable_state: "unstable"` (no evalúa la regla para usuarios anónimos), así que la prueba
   pública del bloqueo es la configuración de la rama (`enforcement_level: everyone`) más el PR.
2. Al fijar `packageManager`, pnpm 12 agrega al lockfile su propia versión con hashes de
   integridad: no es una dependencia de la aplicación.
3. La ganancia de la cache es chica (~4 s): pnpm ya instala rápido. Se demuestra que funciona,
   no que acelere mucho.
4. La rama `tp-6-evidencia-rojo` queda en GitHub como respaldo del PR #1 (nunca se mergea).
5. Desde ahora (TP-3, TP-4, TP-7) cada TP va en su rama y entra por PR; el contrato del TP-5
   exigirá casos para cada endpoint nuevo y `gates` hará cumplir el umbral 75/75.
