VEREDICTO: APROBADO (el caso 9 —publicar en `main` sin secrets de servidor— se confirma en la corrida de `main` tras el merge)

# Validación 007 — Docker, despliegue continuo y observabilidad (TP-7)

Fecha: 16/11/2026 · Rol: reviewer · Rama `tp-7-docker-cd`
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `docs/constitution.md`,
`consignas/TP7-docker-cd-observabilidad.md`, el código, `git log` y la corrida de Actions
[43915953632](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/actions/runs/43915953632)
(extracto del log en [`docs/evidencias/007-docker-image-pr.txt`](../../docs/evidencias/007-docker-image-pr.txt)).

## Gates

**Locales (tras T8):**

| Gate | Resultado |
|---|---|
| `pnpm lint` | 0 errores, 0 avisos |
| `pnpm build` | OK |
| `pnpm test` | 483 en verde |
| `pnpm test:e2e` | 514 en verde (incluye el contrato con `GET /health` 200 y 503) |
| `pnpm test:cov` | líneas 82,46% · ramas 86,25% (umbral 75/75) |
| `pnpm typecheck` | OK |

**En Actions (PR):**
- `CI / gates`: verde.
- `Docker / image`: verde en 343 s.
  - Dentro del build de la imagen corrieron lint, build, 47 archivos unit (483 tests) y 25
    archivos e2e (514 tests).
  - `publish` y `deploy` se saltearon, como corresponde en un PR.

## Requisitos → evidencia → resultado

| RF | Evidencia | Resultado |
|---|---|---|
| RF-1 multi-stage con gates en el build | `Dockerfile`: etapas `build` → `prod-deps` → `runtime`, con `RUN pnpm lint && pnpm build && pnpm test && pnpm test:e2e`. En la corrida pasaron unit y e2e dentro del build | OK |
| RF-2 no root, sin toolchain ni secretos | Caso 10: uid 1000; sin pnpm, npm, npx ni TypeScript. Caso 11: canario. `.dockerignore` | OK |
| RF-3 misma imagen en todo entorno | Todo entra por variables: `env_file` y `environment` del compose; la imagen no trae `.env`. Casos 5 y 12 usan la misma imagen con distintos `.env` | OK |
| RF-4 compose con healthcheck, volumen y `restart: always` | `docker-compose.yml`; caso 12 (`healthy`), caso 1 (nunca `healthy`), caso 6 (vuelve solo) | OK |
| RF-5 `/health` real, 200/503 con `detail` | `health.e2e` (200 sin credencial; 503 con la conexión real cerrada); `health.spec` (consulta `sqlite_master`, no `SELECT 1`); contrato 200 y 503; caso 12 en Docker | OK |
| RF-6 variable inválida → no arranca y la nombra | `env.validation.spec` (`LOG_LEVEL=loud`); caso 5 en Docker (`JWT_SECRET` corto y `LOG_LEVEL=loud`) | OK |
| RF-7 base que no abre → error claro, nunca `healthy` | App compilada local: `fatal` "file is not a database" y código 1 (`abortOnError: false`). Caso 1 en Docker | OK |
| RF-8 publicar en `ghcr.io` con sha y `latest`, no en PR | Job `publish` (solo push a `main`, `packages: write`, publica la imagen probada). En el PR quedó salteado | OK en PR · publicación: caso 9 tras el merge |
| RF-9 deploy por SSH con `deploy.sh`, espera `healthy`, en fila, salteado sin secrets | `deploy.sh` probado en Actions (caso 12: tres despliegues `healthy`; caso 17: falla y muestra logs). Job `deploy` con `concurrency: deploy` y validación del tag | OK · salteo sin secrets: caso 9 tras el merge |
| RF-10 rollback sin reconstruir | Caso 12: ci-v1 → ci-v2 → ci-v1. `workflow_dispatch` con `tag`. README | OK |
| RF-11 una línea JSON por evento, sin `console.log` | `json-logger.spec`; app compilada (todas las líneas JSON); `grep console.*` en `src/`: ninguno | OK |
| RF-12 línea por pedido, nivel por código, `/health` en debug | `request-context.spec` (niveles, ruta sin query, duración); `observability.e2e` (casos 4, 14, 15, 404 → warn) | OK |
| RF-13 `requestId` seguro o UUID, en la respuesta | `observability.e2e` casos 7 y 8; `request-context.spec`; caso 12 en Docker (`X-Request-Id: smoke-12` y log con ese id) | OK |
| RF-14 sin datos sensibles | `sanitize.spec` (Bearer, JWT, `password`/`token`/`secret`/`authorization`/`dni`); `json-logger.spec`; `observability.e2e` caso 4 (500 real con `Authorization`: sin token) y login (sin contraseña) | OK |
| RF-15 `LOG_LEVEL` | `json-logger.spec` (los 6 niveles); `observability.e2e` caso 15 (`warn`: el 200 no escribe, el 404 sí) | OK |
| RF-16 apagado ordenado | `shutdown-logger.spec`; caso 16 en Docker (`SIGTERM` → apagado registrado, código 0) | OK |
| RF-17 preparación del servidor | README, sección "Preparar un servidor" (4 secrets, `~/chinook`, `.env`, `docker login` si el paquete fuera privado) | OK (documentado; no hay servidor) |

## Requisitos no funcionales

| RNF | Evidencia | Resultado |
|---|---|---|
| RNF-1 reproducible | Caso 3: dos builds sin caché, 23.456 entradas (hash, permisos, dueño, ruta) idénticas. Los ids difieren por la fecha de creación, que la spec deja como informativa. Base fijada por digest, lockfile congelado, pnpm fijo | OK |
| RNF-2 sin secretos en imagen ni en git | Caso 11 (canario ausente en `docker history` y en los archivos); ningún `.env` en el historial de git | OK |
| RNF-3 evidencia en Actions | `docker.yml`, job `image` en cada PR y push a `main` | OK |
| RNF-4 CI intacto | `ci.yml` sin cambios; `gates` sigue siendo el único check requerido | OK |
| RNF-5 permisos mínimos | Permisos `contents: read` en todo el workflow; `packages: write` solo en `publish`; publicar y desplegar no corren en PRs | OK |
| RNF-6 gates, cobertura, contrato, rama y PR | Gates arriba; contrato con `/health`. *Corrección en T3:* los conteos de `protection`/`docs` siguen en 34 (son de `/api/v1`) y `/health` tiene tests propios | OK |
| RNF-7 `JWT_SECRET` generado en la corrida | `smoke-test.sh` usa `openssl rand -hex 32` en cada `.env` temporal | OK |

## Casos límite (1–17)

| # | Evidencia | # | Evidencia |
|---|---|---|---|
| 1 | `smoke-test.sh` "OK caso 1" + app compilada local | 10 | `smoke-test.sh` "OK caso 10" |
| 2 | `health.e2e` (conexión real cerrada → 503) | 11 | `smoke-test.sh` "OK caso 11" (canario) |
| 3 | Paso "Comparar las dos imágenes": "OK caso 3" | 12 | `smoke-test.sh` "OK caso 12" ×2 (deploy + rollback) |
| 4 | `observability.e2e` (500 real) + `sanitize`/`json-logger.spec` | 13 | `health.e2e` + `protection.e2e` |
| 5 | `env.validation.spec` + `smoke-test.sh` "OK caso 5" | 14 | `observability.e2e` + `request-context.spec` |
| 6 | `smoke-test.sh` "OK caso 6" (reinicio del daemon) | 15 | `observability.e2e` + `json-logger.spec` |
| 7 | `observability.e2e` | 16 | `shutdown-logger.spec` + `smoke-test.sh` "OK caso 16" |
| 8 | `observability.e2e` + `request-context.spec` | 17 | `smoke-test.sh` "OK caso 17" |
| 9 | **Pendiente:** corrida de `main` tras el merge (`publish` publica; `deploy` muestra el aviso y queda verde) | | |

## Consigna

| Exigencia | Evidencia |
|---|---|
| Spec aprobada en `specs/007-docker-cd/spec.md` | `2c41e5c` |
| Dockerfile multi-stage, sin toolchain, no root, `.dockerignore` | RF-1, RF-2; casos 10 y 11 |
| Compose API + base, `healthcheck`, `depends_on` condicionado, no ready sin base | RF-4, RF-5, RF-7; casos 1 y 2. **Adaptación declarada en la spec:** SQLite es embebida, no hay un segundo servicio para `depends_on` |
| Variables por entorno, ningún secreto en la imagen | RF-3, RNF-2 |
| CD: build → registry → SSH → reinicio, secretos en *repository secrets* | RF-8, RF-9; `docker.yml`. **Adaptación declarada:** no hay servidor; el mismo `deploy.sh` se prueba con el runner como servidor |
| Logs estructurados con nivel, mensaje, `requestId`, timestamp | RF-11–RF-14 |
| `GET /health` con el estado real | RF-5 |
| Observe opcional con credenciales | RF-15 (se mantiene el comportamiento previo) |
| Los 4 gates también dentro del build de la imagen | RF-1; log de la corrida |
| Los 5 casos de la consigna | Casos 1, 3, 4, 5 y 6 de la spec |
| Una máquina limpia con un comando, en el README | README: `docker compose up -d --wait` |
| CD sin intervención y rollback documentado | README "Rollback" + caso 12 |
| "¿Qué pasó a las 3 AM?" | README: filtros de `docker compose logs` con `jq` por hora, nivel y `requestId` |
| `docker history` limpio, nada en el historial de git | Caso 11; ningún `.env` versionado |

## Constitución

- Sin `any`, sin `@ts-ignore`.
- Sin casts forzados en el código nuevo: un cast del primer borrador de `json-logger.ts` se
  reemplazó por `Object.entries` antes del commit. Los tests usan interfaces mínimas
  (`ContextRequest`, `StatusSetter`).
- Ningún test borrado. Los tests que cambiaron fueron por requisitos nuevos:
  - `env.validation.spec` suma `LOG_LEVEL` a las claves esperadas.
  - `createTestApp` muestra solo errores.
  - `protection`/`docs` agregan tests de `/health`.
  - El contrato suma `setDatabaseUp`.
- `docs/constitution.md` sin tocar. Secretos solo en `.env` o en *repository secrets*.

## Proceso

Spec + clarify (`2c41e5c`; ronda 1 CAMBIOS NECESARIOS con 14 detecciones, ronda 2 APROBADA) →
plan y tareas (`9f547e6`) → T1 `ce1cc83` · T2 `bd67cda` · T3 `6d31a05` · T4 `5d07378` →
T5 `9cb04d2` · T6 `0529f99` · T7 `5afb92a` (sin `[x]` hasta la corrida) → cierre `4a271bd` con
la corrida verde → T8 `56acc56`. `MEMORY.md` en cada tarea. Push de la rama autorizado por el
usuario para T5–T8.

## Observaciones (no bloquean)

1. **Correcciones registradas durante la implementación:**
   - Plan, T2: el middleware de contexto va primero. La mutación mostró que el lector de JSON
     conserva el contexto, y el caso 4 lo protege.
   - Spec RNF-6, T3: los conteos siguen en 34.
2. **Hallazgo de Nest:** por defecto, un arranque fallido hace `process.abort()` sin explicar
   nada. Se desactivó (`abortOnError: false`) y el error se registra como `fatal`.
3. **Log de los tests:** las líneas `ERROR` que se ven al correr los tests son fallas
   **provocadas a propósito** y esperadas:
   - Caso 20 del TP-4 (falla del pago).
   - `health.spec`, `health.e2e` y el contrato 503.

   Asustan al leer el log de un build. Mejora posible: silenciarlas en esos tests puntuales.
   `MaxListenersExceededWarning` viene del test de concurrencia del TP-4 (más de 10 conexiones
   simultáneas a propósito) y ya estaba anotado.
4. **Logs de Actions:** la API de GitHub solo entrega logs a administradores. La evidencia
   detallada sale del zip descargado desde la web; su extracto quedó versionado.
5. **GHCR en la organización:** si la organización no permite crear paquetes con el token de
   las corridas, `publish` fallaría en `main`. No afecta a `gates`; se resuelve en la
   configuración de la organización.
6. **Pendiente heredado:** los demás repositories del catálogo siguen escribiendo ids como
   literales en el SQL (observación del TP-3 y del TP-4).
