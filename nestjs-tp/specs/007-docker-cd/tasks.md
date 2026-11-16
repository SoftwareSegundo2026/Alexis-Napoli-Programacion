# Tareas 007 — Docker, despliegue continuo y observabilidad (TP-7)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/007-docker-cd/plan.md`

Reglas: una tarea por vez, tests primero (en rojo), gates en verde (`lint`, `build`, `test`,
`test:e2e`, `test:cov`, `typecheck`), un commit `007-Tn: …` en la rama `tp-7-docker-cd`, `[x]` y
`MEMORY.md`. Las tareas de Docker (T5–T7) se verifican en Actions: el usuario autorizó (16/11)
pushear la rama `tp-7-docker-cd` (nunca `main`) durante T5–T8.

- [x] **T1. Logger JSON, saneo y `LOG_LEVEL`.** RF-6, RF-11, RF-14, RF-15 · casos 4 (parte), 5, 15 (parte)
      `sanitize.ts`, `json-logger.ts`; `LOG_LEVEL` en `validateEnv` y `.env.example`.
      Hecho cuando: `pnpm test` pasa:
      - `sanitize` tapa Bearer, JWT y valores de `password`/`token`/`secret`/`authorization`/`dni`.
      - `JsonLogger` escribe JSON válido con `timestamp`, `level`, `message`, `context`, `stack`
        en los errores, y filtra por nivel.
      - `LOG_LEVEL=loud` → error que nombra `LOG_LEVEL`.
      Estimación: 20 min · depende de: —

- [ ] **T2. `requestId` y log por pedido.** RF-12, RF-13 · casos 4, 7, 8, 14, 15
      `request-context.ts` (AsyncLocalStorage + middleware) en `configureApp`; `JsonLogger` y
      `bufferLogs` en `main.ts`; `createTestApp` con `logger: ['error', 'fatal']`.
      Hecho cuando: `pnpm test:e2e` pasa `observability.e2e`:
      - `X-Request-Id` válido se respeta; uno inválido se reemplaza por un UUID.
      - Una línea por pedido con el nivel según el código y la ruta sin query.
      - Un 500 real con `Authorization` deja un error con `requestId` y sin el token.
      Estimación: 30 min · depende de: T1

- [ ] **T3. `GET /health`.** RF-5 · casos 2, 13
      `DatabaseProbe`, `HealthController` (fuera del prefijo, público, documentado), doble del
      probe en el contrato, `protection.e2e`/`docs.e2e` → 35; `/health` 200 en nivel `debug`.
      Hecho cuando: `pnpm test:e2e` pasa:
      - `health.e2e`: 200 sin credencial; 503 con `detail` tras `dataSource.destroy()`.
      - El contrato con `GET /health · 200` y `· 503`, y el inventario completo.
      Estimación: 25 min · depende de: T2

- [ ] **T4. Apagado ordenado.** RF-16 · caso 16 (parte)
      `ShutdownLogger` (`beforeApplicationShutdown`); `enableShutdownHooks(['SIGTERM', 'SIGINT'],
      { useProcessExit: true })` en `main.ts`.
      Hecho cuando: `pnpm test` pasa: la señal queda registrada con nivel `log`.
      Estimación: 10 min · depende de: T1

- [ ] **T5. Imagen y compose.** RF-1–RF-4, RF-7, RNF-1, RNF-2
      `Dockerfile` (build con gates → prod-deps → runtime no root, sin npm/pnpm/tsc),
      `.dockerignore`, `docker-compose.yml` (volumen, healthcheck, `restart: always`, `init`).
      Hecho cuando: el job `image` de T7 construye la imagen y `docker compose up --wait` queda
      `healthy` (se verifica junto con T7; localmente no hay Docker).
      Estimación: 25 min · depende de: T3, T4

- [ ] **T6. Scripts de despliegue y evidencia.** RF-9, RF-10, RNF-1, RNF-7 · casos 1, 3, 5, 6, 10, 11, 12, 16, 17
      `deploy/deploy.sh`, `deploy/image-manifest.sh`, `deploy/smoke-test.sh`.
      Hecho cuando: `bash -n` pasa en los tres localmente, y en Actions (T7) cada caso imprime
      "OK caso N".
      Estimación: 30 min · depende de: T5

- [ ] **T7. Workflow `docker.yml`.** RF-8, RF-9, RF-10, RNF-3–RNF-5 · casos 3, 9
      Jobs `image` (PR y `main`), `publish` (`main`, `packages: write`) y `deploy` (`main` o
      manual con sha, en fila, salteado con aviso sin secrets).
      Hecho cuando: en el PR, el job `image` termina en verde con los casos de T6 y la comparación
      de imágenes, y `gates` sigue en verde. El caso 9 se confirma en la corrida de `main` tras
      el merge.
      Estimación: 30 min (+ iteraciones en Actions) · depende de: T6

- [ ] **T8. README de operación.** Criterios de evaluación de la consigna
      Levantar en una máquina limpia (`docker compose up -d`), variables, preparar el servidor
      (RF-17, secrets), despliegue, rollback, y cómo responder "¿qué pasó a las 3 AM?" con
      `docker compose logs` y el `requestId`.
      Hecho cuando: cada sección enlaza la evidencia (corrida de Actions) y los comandos coinciden
      con los scripts.
      Estimación: 15 min · depende de: T7

Después de T8: `validate.md`, PR y merge del usuario; confirmar el caso 9 en `main`.
