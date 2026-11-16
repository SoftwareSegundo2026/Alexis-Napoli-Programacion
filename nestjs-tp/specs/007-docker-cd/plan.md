# Plan 007 — Docker, despliegue continuo y observabilidad (TP-7)

Estado: **aprobado** (16/11, Alexis Napoli; incluye `DEPLOY_KNOWN_HOSTS`) · Spec: `specs/007-docker-cd/spec.md` (aprobada el 16/11, clarify ronda 2)

## Dependencias nuevas

- **npm: ninguna.** El logger, el `requestId` y `/health` usan solo Nest y Node
  (`AsyncLocalStorage`, `crypto.randomUUID`).
- **Imagen base:** `node:24.14.1-bookworm-slim@sha256:b506e7321f176aae77317f99d67a24b272c1f09f1d10f1761f2773447d8da26c`.
  Es la misma versión de Node que la máquina local y el CI. Se usa Debian slim y no Alpine porque
  `better-sqlite3` trae binarios precompilados para glibc: no hace falta compilar nada.
- **Actions:** las mismas que el CI (`actions/checkout@v5`, `actions/upload-artifact@v4`) más
  `actions/download-artifact@v4`, de la misma familia oficial. Sin acciones de terceros: el login
  a `ghcr.io` y el SSH se hacen con comandos.

## Hallazgos que definen el diseño (verificados el 16/11)

- **Apagado (Nest 12, `nest-application-context.js`):** `enableShutdownHooks(signals,
  { useProcessExit: true })` cierra la app y termina con `process.exit(0)`. Sin esa opción, Nest
  se vuelve a mandar la señal y el proceso sale con 143, lo que contradice RF-16.
- **Pedidos en curso (`express-adapter.js`):** `close()` hace `httpServer.close()`, que deja de
  aceptar conexiones y **espera** a que terminen los pedidos activos. Solo los corta si se activa
  `forceCloseConnections`, y no lo activamos.
- **Contexto por pedido:** el lector de JSON termina en callbacks de stream, que pueden perder el
  `AsyncLocalStorage`. Por eso el middleware de contexto va **después** del lector de JSON y del
  `deferJsonSyntaxError`: todo lo que hace Nest después queda dentro del contexto del pedido. El
  test del caso 4 (POST con cuerpo que termina en 500) lo verifica.
- **Inventario del contrato:** cuenta pares `MÉTODO ruta · estado`. Documentar `/health` con 200 y
  503 exige un caso de contrato para cada uno.
- **pnpm:** `.modules.yaml` y `.pnpm-workspace-state*.json` guardan fechas. No hacen falta en
  runtime y se borran de la imagen; si no, dos builds nunca darían el mismo contenido (RNF-1).

## Estructura

```
nestjs-tp/
  src/observability/
    sanitize.ts            # tapa Bearer/JWT y valores de campos sensibles (RF-14)
    json-logger.ts         # LoggerService: una línea JSON por evento, filtro por nivel (RF-11, RF-15)
    request-context.ts     # AsyncLocalStorage + middleware: requestId, X-Request-Id, log por pedido (RF-12, RF-13)
    shutdown-logger.ts     # beforeApplicationShutdown: registra el apagado (RF-16)
  src/health/
    database-probe.ts      # DatabaseProbe: SELECT COUNT(*) FROM sqlite_master (RF-5)
    health.controller.ts   # GET /health público, 200/503, fuera del prefijo
    health.module.ts
  src/config/env.validation.ts   # + LOG_LEVEL (RF-6, RF-15)
  src/app.setup.ts               # + middleware de contexto, exclusión de /health del prefijo
  src/main.ts                    # bufferLogs + JsonLogger + enableShutdownHooks(useProcessExit)
  Dockerfile                     # build (gates) → prod-deps → runtime (RF-1, RF-2)
  .dockerignore
  docker-compose.yml             # api + volumen + healthcheck + restart: always + init (RF-4)
  deploy/
    deploy.sh                    # copia compose, pull, up -d con IMAGE_TAG, espera healthy (RF-9, RF-10)
    image-manifest.sh            # ruta, permisos y SHA-256 de cada archivo de la imagen (RNF-1)
    smoke-test.sh                # casos 1, 5, 6, 10, 11, 12, 16, 17 contra Docker real (RNF-3)
.github/workflows/docker.yml     # image (PR y main) → publish (main) → deploy (main / manual)
```

## Decisiones (y por qué)

1. **Logger propio (`JsonLogger implements LoggerService`).**
   - Escribe con una función inyectable (`write`): en producción es `process.stdout.write`; en
     los tests, un arreglo. Así se prueba sin capturar la consola.
   - Cada línea lleva `timestamp`, `level`, `message`, `context` y `requestId` si hay contexto.
     Los errores llevan `stack`.
   - Todo texto pasa por `sanitize` antes de escribirse.
   - Se activa en `main.ts` con `bufferLogs: true`, así los mensajes del arranque también salen
     en JSON.
2. **Contexto por pedido con `AsyncLocalStorage`.**
   - Un middleware de Express (registrado en `configureApp`, así los e2e prueban lo mismo que
     producción) toma o genera el `requestId`, lo pone en `X-Request-Id` y corre el resto del
     pedido dentro del contexto.
   - Al terminar la respuesta (`finish`) escribe la línea del pedido, con el nivel según el código
     y `/health` 200 en `debug`.
   - La ruta sale de `req.originalUrl` sin la query.
3. **Los e2e existentes no se llenan de líneas:** `createTestApp` crea la app con
   `logger: ['error', 'fatal']`. Cada pedido de los ~500 tests escribiría una línea `log`/`warn`.
   Los tests de observabilidad usan su propio `JsonLogger` con un arreglo como salida.
4. **`/health` con un `DatabaseProbe` inyectable.**
   - En producción ejecuta la consulta real.
   - El contrato lo reemplaza por un doble controlable (como el medio de pago del TP-4), para
     poder pedir el 503 sin romper la base que comparten los demás casos.
   - El caso 2 sí cierra la conexión **real** (`dataSource.destroy()`) en su propia app.
   - El 503 se arma con `@Res({ passthrough: true })`, no con una excepción: el filtro global
     reduciría el cuerpo a `{detail}` y perdería `status`/`database`.
5. **Apagado:** `enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true })` más un
   `ShutdownLogger` que registra la señal. TypeORM cierra la base en `onApplicationShutdown`,
   después de que el servidor terminó los pedidos. En compose, `init: true` (un mini proceso 1
   que reenvía señales) y `stop_grace_period: 20s`.
6. **Dockerfile en 3 etapas.**
   - **build:** pnpm 12.6.0 con `npm i -g`, `pnpm install --frozen-lockfile`, código, y los
     4 gates (`lint`, `build`, `test`, `test:e2e`). Si uno falla, no hay imagen.
   - **prod-deps:** `pnpm install --prod --frozen-lockfile`, sin las dependencias de desarrollo,
     y se borran los archivos de estado de pnpm con fechas.
   - **runtime:**
     - Copia `node_modules` de producción, `dist/`, la plantilla `data/chinook.template.db` y
       `package.json`.
     - Borra `npm`, `npx` y `corepack`: una imagen de runtime no necesita instalar nada.
     - Crea `/var/lib/chinook`, del usuario `node`, para el volumen.
     - Corre como `USER node`, con `NODE_ENV=production` y `CMD ["node", "dist/main.js"]`.
     - Los archivos de la app quedan de root y de solo lectura para `node`: aunque alguien tome
       el proceso, no puede modificar el código.
7. **Compose.**
   - `image: ghcr.io/softwaresegundo2026/alexis-napoli-programacion:${IMAGE_TAG:-latest}` y
     `env_file: .env`.
   - `environment` fija `PORT=3000` y `DATABASE_PATH=/var/lib/chinook/chinook.db`: le gana al
     `.env` y el healthcheck siempre sabe dónde mirar.
   - Volumen nombrado `chinook-data`, puerto `${API_PORT:-3300}:3000`, `restart: always`,
     `init: true`.
   - Healthcheck con `node -e "fetch('http://127.0.0.1:3000/health')…"` (la imagen slim no trae
     curl): intervalo 10 s, reintentos 3, `start_period` 20 s.
8. **`deploy.sh <sha>`, un solo script para servidor y prueba.**
   - Recibe el sha y opcionalmente `PULL=0`, para usar una imagen local en la prueba.
   - Hace `docker compose pull` y `up -d --wait --wait-timeout 60`: `--wait` espera a
     `healthy`.
   - Si falla, muestra `docker compose logs --tail 50` y sale con código ≠ 0.
   - Usa `set -euo pipefail`: cualquier error corta el script.
9. **Workflow `docker.yml`** (aparte de `ci.yml`, RNF-4).
   - **`image`** (PR y push a `main`):
     - Crea un `.env` canario con un secreto falso dentro del contexto, para probar que el
       `.dockerignore` lo deja afuera.
     - Construye dos veces con `--no-cache`, compara los listados de `image-manifest.sh`
       (RNF-1, caso 3) e informa ambos digests.
     - Corre `smoke-test.sh`, que genera el `JWT_SECRET` al azar (RNF-7) y prueba los casos 1, 5,
       6 (`sudo systemctl restart docker`), 10, 11 (busca el canario en `docker history` y en la
       imagen), 12, 16 y 17.
     - En push a `main`, guarda la imagen probada como artefacto (`docker save`, retención 1 día).
   - **`publish`** (solo push a `main`, `packages: write`): carga **la misma imagen probada**, la
     etiqueta con el sha y `latest` y la sube a `ghcr.io`. Se publica exactamente lo que se probó.
   - **`deploy`** (push a `main` tras `publish`, o manual con `workflow_dispatch` y un sha =
     rollback):
     - Va en `concurrency: deploy` sin cancelar: los despliegues van en fila.
     - Si faltan los secrets, emite `::notice::` y termina en verde.
     - Si están, copia `docker-compose.yml` y `deploy.sh` por `scp` y ejecuta
       `ssh … ./deploy.sh <sha>`.
     - Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` y **`DEPLOY_KNOWN_HOSTS`** (ver
       la decisión 10).
10. **`DEPLOY_KNOWN_HOSTS`, un cuarto secret.** Es la "huella" del servidor. Sin ella, el SSH
    tendría que aceptar a ciegas cualquier servidor que conteste en esa dirección, y un impostor
    podría recibir el despliegue. Va junto a los otros tres, que la spec ya lista como "datos del
    servidor".
11. **Variables.** `LOG_LEVEL` se valida en `validateEnv` con el mismo estilo de mensaje que las
    demás. `.env.example` suma `LOG_LEVEL` y `API_PORT`, y explica qué fija el compose.

## Estrategia de tests

| Qué | Dónde |
|---|---|
| `sanitize` (Bearer, JWT, `password=`, `"token":"…"`, `dni`) | Unit |
| `JsonLogger`: campos, nivel mínimo, `requestId`, stack, saneo (casos 4 y 15) | Unit |
| `validateEnv` con `LOG_LEVEL` válido, inválido (`loud`) y ausente (caso 5) | Unit |
| Middleware: `requestId` válido/inválido, header, nivel por código, ruta sin query, `/health` en debug (casos 7, 8, 14, 15) | Unit + e2e `observability.e2e` |
| Error 500 real (pago con error del TP-4) con `Authorization`: el log de error tiene el `requestId` y no tiene el token (caso 4) | e2e `observability.e2e` |
| `/health` 200 público; 503 con la conexión cerrada (casos 2 y 13) | e2e `health.e2e` |
| `/health` 200 y 503 en el contrato (doble del probe); `protection`/`docs` → 35 | e2e contrato |
| `ShutdownLogger` registra la señal; `app.close()` cierra sin error | Unit / e2e |
| Imagen, compose, reinicio, apagado, deploy y rollback (casos 1, 3, 5, 6, 10–12, 16, 17) | Workflow `docker.yml` |
| Publicación y despliegue salteado sin secrets (caso 9) | Corrida en `main` tras el merge |

## Riesgos

- **No hay Docker local:** Dockerfile, compose y scripts solo se prueban en Actions. Cada ajuste
  necesita un push de la rama: lo pido de una vez para estas tareas (ver abajo). Localmente
  verifico la sintaxis de los scripts con `bash -n`.
- **Duración:** dos builds sin caché con los gates adentro, más las pruebas, rondan los
  15–20 min. El job tiene `timeout-minutes: 40`.
- **Reproducibilidad:** si aparece otro archivo con fechas o datos variables, `image-manifest.sh`
  muestra la diferencia y se corrige en el Dockerfile.
- **GHCR en una organización:** si la organización no permite crear paquetes con el token de las
  corridas, `publish` falla en `main` después del merge. No afecta a `gates`; se resuelve en la
  configuración de la organización y se documenta.
- **Caso 9 después del merge:** publicar solo ocurre en `main` (RF-8), así que esa evidencia se
  confirma en la corrida de `main`, como pasó con el TP-6.

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

1. Logger JSON, saneo y `LOG_LEVEL`.
2. `requestId` y log por pedido; app de test silenciosa.
3. `GET /health` con probe, contrato y operación 35.
4. Apagado ordenado.
5. Dockerfile, `.dockerignore` y compose.
6. Scripts: `deploy.sh`, `image-manifest.sh`, `smoke-test.sh`.
7. Workflow `docker.yml` (`image`/`publish`/`deploy`) en verde en el PR.
8. README: una máquina limpia, variables, servidor, despliegue, rollback y logs.
