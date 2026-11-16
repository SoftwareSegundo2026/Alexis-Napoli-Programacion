# Plan 006 — Integración continua con GitHub Actions (TP-6)

Estado: **aprobado** (16/11, Alexis Napoli) · Spec: `specs/006-ci/spec.md` (aprobada el 16/11, clarify ronda 2)

## Dependencias nuevas

**Ninguna** en `package.json`. Se usan *actions* oficiales de GitHub y la de pnpm (no son
dependencias del proyecto: corren en la máquina de CI):

| Action | Para qué | RF |
|---|---|---|
| `actions/checkout@v5` | Bajar el código de la corrida | RF-1, RF-2 |
| `pnpm/action-setup@v4` | Instalar pnpm en la versión de `packageManager` | RNF-7 |
| `actions/setup-node@v5` | Node 24 + cache del store de pnpm | RF-6, RNF-7 |
| `actions/upload-artifact@v4` | Publicar el reporte de cobertura | RF-7 |

Se fijan por versión mayor. La primera corrida en GitHub confirma que todas resuelven; si
alguna no, se baja a la mayor anterior y se documenta.

## Hallazgos del análisis previo (verificados el 16/11)

- No hay `.env` local y los 5 gates pasan igual: el setup de los e2e define `DATABASE_PATH`,
  `JWT_SECRET` y `PASSWORD_HASH_ROUNDS` de prueba (`test/helpers/test-env.ts`, no reales).
  **CI no necesita secretos** (RNF-2).
- `pnpm install --frozen-lockfile` funciona con el lockfile actual y pnpm 12.6.0.
- `pnpm-workspace.yaml` ya permite el script nativo de `better-sqlite3` (`allowBuilds`): la
  instalación en Linux compila o baja el binario sin configuración extra.
- El repo es un "monorepo" de la materia: el workflow va en la raíz y todos los pasos
  corren con `working-directory: nestjs-tp`.

## Estructura (lo nuevo y lo que cambia)

```
.github/workflows/ci.yml        ← NUEVO (raíz del repo): job "gates" (T2)
nestjs-tp/package.json          ← script "typecheck" y "packageManager" (T1)
nestjs-tp/README.md             ← sección "Integración continua" + evidencia (T4)
nestjs-tp/specs/006-ci/         ← plan, tasks, validate
```

## Diseño del workflow (`ci.yml`)

```yaml
on: pull_request (a main) · push (a main)          # RF-1, RF-2; sin "paths:" (RF-8)
permissions: contents: read                         # RNF-1
concurrency: grupo por rama, cancel-in-progress     # RNF-6
jobs:
  gates:                                            # nombre FIJO del check (RF-5)
    runs-on: ubuntu-latest · timeout-minutes: 15    # RNF-6
    defaults.run.working-directory: nestjs-tp       # RNF-4
    steps: checkout → pnpm (packageManager) → Node 24 + cache pnpm
           → pnpm install --frozen-lockfile
           → pnpm lint → pnpm build → pnpm test → pnpm test:e2e
           → pnpm test:cov (id: coverage) → pnpm typecheck
           → upload-artifact coverage/ si el paso de cobertura corrió     # RF-7
```

## Decisiones (y por qué), contra la constitution

- **`pull_request`, no `pull_request_target`:** con `pull_request`, GitHub corre el código
  del PR **sin** secretos y con token de solo lectura cuando viene de un fork (caso 7).
  `pull_request_target` corre con permisos del repo y es la fuente típica de filtraciones.
- **Un solo job con pasos en secuencia:** los gates dependen de la misma instalación;
  separarlos en jobs repetiría la instalación 6 veces. Cada paso tiene nombre propio, así
  GitHub muestra cuál falló (RF-3), y un paso en rojo detiene los siguientes.
- **`test` y `test:cov` los dos:** `test:cov` vuelve a correr los unitarios (~10 s más),
  pero así el pipeline usa exactamente los comandos de la constitución y del TP-5 (RF-4) y
  se ve por separado si falló un test o el umbral.
- **Cobertura como artefacto, condición `steps.coverage.outcome != 'skipped'`:** se publica
  si el paso corrió, en verde o en rojo; si el pipeline falló antes, no hay nada que
  publicar (RF-7). `if-no-files-found: error` dentro de esa condición: si corrió y no dejó
  reporte, algo anda mal.
- **Versión de pnpm desde `packageManager`:** una sola fuente de verdad para la PC y CI
  (RNF-7). `pnpm/action-setup` la lee de `nestjs-tp/package.json`.
- **Cache:** `setup-node` con `cache: pnpm` y `cache-dependency-path:
  nestjs-tp/pnpm-lock.yaml`: la clave cambia solo si cambia el lockfile (RF-6).
- **Comentarios:** cada step con un comentario en español que dice qué valida (RNF-3).
- Constitución: no se toca `docs/constitution.md`; los gates son los mismos comandos.

## Orden de integración (RF-9)

1. T1 y T2 se commitean en `main` y se pushean (con OK): el workflow corre por primera vez
   **en verde** y el check `gates` aparece en GitHub.
2. El usuario configura la regla de `main` (guía paso a paso en T3).
3. Desde ahí, todo entra por rama + PR: el PR rojo de evidencia (T3) y la documentación
   (T4) y el cierre (`validate.md`).

## Estrategia de verificación

| Qué | Cómo |
|---|---|
| Script `typecheck` y `packageManager` | Los 5 gates locales + `pnpm typecheck` (T1) |
| Workflow válido y en verde | Primera corrida en GitHub, link en `MEMORY.md` (T2) |
| Cache (caso 3) | Re-ejecutar la corrida: el log de `setup-node` dice "Cache restored" |
| Permisos (caso 9) | Log de "Set up job": `GITHUB_TOKEN Permissions` → `Contents: read` |
| Fork (caso 7) | Lectura del YAML: evento `pull_request` |
| Bloqueo (casos 1, 8) | PR rojo con "Merging is blocked", captura del usuario (T3) |
| Paso que falla (caso 4) | El PR rojo muestra en rojo el paso concreto y los siguientes sin correr |
| Solo docs (caso 2) | El PR de T4 (README y specs) corre el pipeline completo |
| Secretos (RNF-2) | Búsqueda de patrones en el repo y el historial (validate) |

Los casos 5, 6, 10 y 11 se cubren por configuración (umbral del TP-5, `--frozen-lockfile`,
`timeout-minutes`, `concurrency`) y se verifican leyendo el YAML en `validate.md`; no se
fuerzan en GitHub (gastarían corridas sin aportar más evidencia).

## Riesgos

- **Una action con versión inexistente** → la primera corrida falla en "Set up job". Se
  corrige la versión y se documenta.
- **Diferencias Windows/Linux** (rutas, finales de línea): los tests ya usan `os.tmpdir()`
  y `path`; si algo falla solo en Linux, es un bug real que el CI destapa y se trata aparte.
- **El usuario configura la regla antes de que el check exista:** `gates` no aparece en la
  lista. Por eso el orden de arriba.

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

1. **T1** — `package.json`: script `typecheck` y `packageManager` (en `main`).
2. **T2** — `.github/workflows/ci.yml` comentado; push a `main` y primera corrida en verde.
3. **T3** — Regla de protección (guía al usuario) + PR rojo de evidencia, cerrado sin mergear.
4. **T4** — README con la sección de CI y la evidencia, por rama + PR (caso 2).
