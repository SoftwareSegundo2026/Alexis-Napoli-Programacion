# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- TP-1 (`001-chinook-nest`) **cerrado, validado y pusheado** (`91124e0`).
- TP-2 (`002-auth-roles`) **cerrado**: T1–T9 y `validate.md` → APROBADO.
- TP-5 (`005-calidad`) **en curso**: spec, clarify, plan y tareas aprobados; **cerrado**: T1–T7 y `validate.md` → APROBADO (pusheado).
- TP-6 (`006-ci`) **en curso**: spec, clarify, plan y tareas aprobados; **cerrado**: validate APROBADO, PR #2 mergeado (`d452504`).
- TP-3 (`003-busqueda`) **cerrado**: validate APROBADO; PR #3 mergeado (`dd511e1`), gates verde.
- TP-4 (`004-reservas`) **cerrado**: validate APROBADO; PR #4 mergeado (`c449730`), gates verde
  en main (27 casos límite; RF-14 artista con conciertos → 409; RF-15 = pendiente del TP-1; T8
  agregada por la validación: ids como parámetros).
- TP-7 (`007-docker-cd`) **en curso** en la rama `tp-7-docker-cd`: spec y clarify aprobados
  (17 RF, 7 RNF, 17 casos). Decisiones: SQLite en volumen (un servicio `api`, adaptación
  declarada), sin servidor (deploy SSH solo con secrets; `deploy.sh` probado en Actions con el
  runner como servidor), GHCR, logger JSON propio + `requestId` (AsyncLocalStorage). Sin Docker
  local: toda la evidencia de imagen/compose sale de un workflow de Actions.
- 16/11 · 007 plan: Nest 12 `enableShutdownHooks(signals, { useProcessExit: true })` sale con 0
  (sin la opción se re-envía la señal → 143); `ExpressAdapter.close()` espera los pedidos en curso
  (solo corta con `forceCloseConnections`). Inventario del contrato = `MÉTODO ruta · estado`.
- 16/11 · 007-T1: `src/observability/sanitize.ts` (Bearer, JWT `eyJ…`, campos cuyo NOMBRE contiene
  password/token/secret/authorization/dni; conserva comillas → el JSON sigue válido; tapa de más
  antes que de menos) y `json-logger.ts` (`LoggerService`: una línea JSON, `write`/`now`/`requestId`
  inyectables, parámetros de `error` como Nest: `(stack, context)`). `LOG_LEVEL` en `validateEnv`
  (los 6 niveles de Nest; los tests de claves/defaults sumaron `LOG_LEVEL`). oxlint sin problemas
  no imprime nada (exit 0). 453 unit, 495 e2e, cov 82,55% / 85,22%.
- 16/11 · 007-T2: `request-context.ts` (AsyncLocalStorage; middleware con interfaces mínimas
  `ContextRequest`/`ContextResponse` → tests sin casts; el `finish` vuelve a entrar al contexto con
  `storage.run`). Registrado PRIMERO en `configureApp`: el plan suponía que el lector de JSON perdía
  el contexto, pero la MUTACIÓN (middleware antes del lector) dejó todo verde → el lector lo
  conserva; el caso 4 lo protege. `main.ts`: `logger: JsonLogger` desde el arranque y
  `abortOnError: false` (por defecto Nest hace `process.abort()` si falla el arranque y no explica
  nada); el error se registra como `fatal` y sale con 1. `createTestApp(customize, options)`: por
  defecto `logger: ['error', 'fatal']`. Verificado con la app compilada (script del scratchpad
  `probe-app.mjs`, mata SOLO a su hijo): JSON, X-Request-Id, sin query ni token; base inválida →
  `fatal` "file is not a database" y exit 1. 477 unit, 507 e2e, cov 82,25% / 85,78%.
- 16/11 · 007-T3: `src/health/` (`DatabaseProbe` con `SELECT COUNT(*) FROM sqlite_master`, que lee
  el archivo; `HealthController` público con `@Res({ passthrough: true })` para el 503, porque una
  excepción pasaría por el filtro y dejaría solo `{detail}`; interfaz mínima `StatusSetter` → unit
  sin casts). `/health` excluido del prefijo como `GET /`. Contrato `health.cases.ts` (200 y 503)
  con doble `ControllableDatabaseProbe` (`test/helpers/health-doubles.ts`, hook
  `setDatabaseUp`); `health.e2e` con `dataSource.destroy()` REAL → 503. CORRECCIÓN de la spec
  RNF-6: protection/docs cuentan solo `/api/v1` → siguen en 34; `/health` con tests propios.
  481 unit, 514 e2e, cov 82,46% / 85,67%.
- 16/11 · 004 plan: TypeORM 1.1.3 con better-sqlite3 usa UNA conexión (`queryRunner ??=`) y una
  transacción abierta dentro de otra es un SAVEPOINT → `TransactionLock` (FIFO) para reservas.
- 16/11 · 004-T1: `migrations.ts` (Concert/Reservation/Payment, `IF NOT EXISTS`, índice único
  `(UserId, IdempotencyKey)`), `prepareConnection` (sql-functions + migraciones) en
  `DatabaseModule` (ahora `@Global` con `TransactionLock` y `Clock`). Las CLAVES FORÁNEAS SE
  HACEN CUMPLIR (TypeORM activa `foreign_keys`): en tests usar usuarios reales.
- 16/11 · 004-T2: módulo `concerts` (disponibilidad calculada en la misma consulta con un
  subselect + `getRawAndEntities`; `StartsAt` con zona y guardado en UTC; fecha futura con `Clock`);
  RF-14 en `ArtistsService.remove`; contrato `concerts.cases.ts`; protection/docs 26 → 29.
  DESVÍO: por apuro no se corrió el rojo de los e2e antes de implementar (tests escritos antes).
  El GATE DE COBERTURA CORTÓ (71,48% < 75: el módulo solo tenía e2e) → unit de service (Test module,
  sin casts) y repository contra base real → 79,31% / 82,97%. Todo módulo nuevo necesita UNIT tests.
- 16/11 · 004-T3: `reservation-status.ts` (pura: 3 transiciones válidas, las otras 13 → 409 que
  nombra los estados; test con los 16 pares) y `payment-gateway.ts` (interfaz, token
  `PAYMENT_GATEWAY`, `PaymentRejectedError`, simulado que aprueba). typecheck atrapó `charge()` sin
  parámetro en el simulado.
- 16/11 · 004-T4: módulo `reservations` (alta = `lock.run(() => dataSource.transaction(...))`:
  clave previa → misma reserva o 409; concierto 404; empezado 400; cupo 409; INSERT PENDING →
  `gateway.charge` (rechazo → 402) → pago APPROVED → PAID). `@IdempotencyKey()` es decorador de
  parámetro: `@Headers()` de Nest NO acepta pipes (se ignoraba en silencio). Test helper: con
  `key = nextKey()` por defecto, pasar `undefined` usa el default → usar `null`. Dobles en
  `test/helpers/reservations-doubles.ts` (`ControllablePaymentGateway`, `FakeClock`, `withDoubles`)
  y `createTestApp(customize)`; el contrato usa el doble para el 402. protection/docs → 32 ops.
- 16/11 · 004-T5: `reservations-concurrency.e2e` SIN sleep: barrera en el pago + `until(cond)` que
  cede el turno (setImmediate) hasta que A está cobrando y B está en el candado
  (`TransactionLock.pending`, nuevo) o cobrando. MUTACIÓN sin candado: caso 13 vendió 12 de 5
  (sobreventa), caso 1 dio [201, 500] (SAVEPOINT anidado), caso 21 falló; caso 8 pasa igual
  (lo protege que PENDING no cuenta, no el candado).
- 16/11 · 004-T6: `cancel` (dueño; repetido → misma; COMPLETED → 409 por `assertTransition`;
  concierto empezado → 409; reembolso REFUNDED en la misma transacción) y `complete` (admin;
  repetido → misma; CANCELLED → 409; no empezado → 409), ambos bajo el candado. Contrato con
  `setNow` (reloj); protection/docs → 34 ops. 412 unit, 494 e2e, cov 81% / 83,68%.
- 16/11 · 004-T7 (RF-15, pendiente del TP-1): `catalog-concurrency.e2e`, 10 rondas de 2 PATCH
  simultáneos → siempre gana uno ENTERO. Caracteriza lo existente (sin cambios de código).
  Mutación "guardar campo por campo cediendo el turno" NO mezcla (Node atiende en orden FIFO):
  mala mutación, no mal test. Mutación "guardar solo el nombre" → el test FALLA (detecta mezcla).
- 16/11 · 004-T8 (RNF-5, hallazgo de la validación): `findOneBy`/`update` de TypeORM dejaban los
  ids como literal (`WHERE "ReservationId" = 2`). El repository de reservas pasó a QueryBuilder con
  `CAST(:x AS INTEGER)` y el valor como texto. Test con `logging: true` + logger que GUARDA el SQL:
  ninguna condición compara contra un número literal (rojo: 11 consultas; LIMIT/OFFSET exceptuados).
  413 unit, 495 e2e, cov 81,12% / 83,68%. Los INSERT de `save()` ya usaban `?`.
- Tests: `pnpm test` 360 y `pnpm test:e2e` 413 en verde (rama `tp-3-busqueda`).
- Tests: `pnpm test` 279 (31 archivos) y `pnpm test:e2e` 380 (17 archivos) en verde; lint sin avisos;
  `pnpm exec tsc --noEmit -p tsconfig.json` también limpio (chequea los tipos de `test/`).
- Cobertura (unit, todo `src/`): líneas 76,52% (476/622, **146 sin cubrir**) · ramas 80,4%
  (201/250, **49 sin cubrir**). Umbral 75/75. Ninguna tarea del TP-5 puede subir lo sin cubrir.

## Decisiones (y por qué)
- 15/11 · Base `programacion/nestjs-music`; constitución del docente sin cambios; lint con
  `no-explicit-any` y `ban-ts-comment` en `error`; skills `sdd` y `nestjs-esm` creadas.
  Orden de TPs: 1 → 2 → 5 → 6 → 3 → 4 → 7. TP-8 no se hace (optativo).
- TP-1 (detalle en `specs/001-chinook-nest/plan.md` y `validate.md`):
  - Template `data/chinook.template.db` versionado; base de trabajo ignorada; cada e2e trabaja
    sobre su copia en `os.tmpdir()` preparada en `test/setup-e2e.ts` antes de importar `AppModule`.
  - `configureApp` compartido por `main.ts` y los e2e: prefijo `/api/v1`, `RequestValidationPipe`
    (cuerpo rechaza campos desconocidos, query los ignora), filtro `{"detail"}`, Swagger.
  - Patrón de recurso: entidad camelCase→PascalCase, repository (DAO), service (404/409),
    controller (Facade), DTOs con `fromEntity`. PATCH: obligatorios con `@IfPresent()`,
    opcionales con `@IsOptional()` (`null` quita el valor).
  - Clave fija como middleware (antes del lector del cuerpo) — se reemplaza en 002-T4.
- 16/11 · 002-T1: `JWT_SECRET` obligatorio (≥ 32), `JWT_EXPIRES_MINUTES` (30), `PASSWORD_HASH_ROUNDS`
  (12; 4 en los e2e). Los 6 casos previos de `env.validation.spec` se conservaron (con secreto).
  Secreto de prueba en `test/helpers/test-env.ts`: no es real (RNF-3).
- 16/11 · 002-T2: `PasswordHasher` en `users/` (no en `auth/`: evita dependencia circular);
  `UsersModule` exporta repository y hasher. `bcryptjs` lee los `$2b$` de Python (verificado).
  `UsersRepository` se testea contra una copia REAL de la base (SQL propio: `LOWER(TRIM())`,
  `select: false`, índice único → `DuplicateUserError`).
- 16/11 · 002-T3: `AuthService` (login con verificación ficticia; `authenticate` con regex
  `Bearer` sin mayúsculas, HS256 fijo — rechaza `alg: none` —, `sub` numérico, usuario de la
  base). Guards `AuthenticationGuard` y `RolesGuard` + `@Public`/`@Roles`/`@CurrentUser`.
  `AuthModule` registrado en `AppModule` pero los guards AÚN no son globales (eso es T4).
  Tests de `AuthService` con `JwtService` REAL (vencida, alterada, otro secreto, sin firma).
- 16/11 · 002-T4 (conmutación): guards como `APP_GUARD`; `useBodyParser('json')` + `deferJsonSyntaxError`
  + `BodyParseErrorInterceptor`; `WWW-Authenticate: Bearer` en el filtro; `@Public` en GETs y
  `AppController`, `@Roles('admin')` en escrituras; clave fija y `WRITE_API_KEY` eliminadas.
  Tests del TP-1 MIGRADOS (no borrados): `withKey` → `asAdmin` (token de `test_admin` sembrado
  por `test/helpers/auth.ts`). `write-key.middleware.spec` (13 casos) eliminado junto con el
  middleware; su cobertura pasó a: clave exacta/alterada/vacía/ausente → `auth.service.spec` +
  `security.e2e`; GET libre → `security.e2e` (lecturas públicas); escritura sin credencial → 401
  → `guards.spec` + `security.e2e` (12 rutas); "config sin clave" → `env.validation.spec` (JWT_SECRET).
  Swagger sigue mostrando X-API-Key hasta T8 (documentado en `app.setup.ts`).
- 16/11 · 002-T5: `POST /auth/token` (@Public, 200). `LoginDto` solo exige textos (vacío → 401, no
  400). Verificado a mano con el `admin` real de la base (hash de Python, costo 12, ~300 ms).
  `docs.e2e` ajustado: cuenta las 20 operaciones DEL CATÁLOGO y verifica el login sin seguridad.
- 16/11 · 002-T6: `GET /users/me`, `GET /users` y `POST /users` (admin). La contraseña NO se recorta
  (RF-1 la compara exacta; prevalece sobre la regla general de recorte). Altas en cola (promesa
  encadenada). Mutación: sin la cola falla el unit test; el e2e sigue verde porque el índice
  único de la base es la red de seguridad (las dos capas funcionan).
- 16/11 · 002-T7: `PATCH /users/{id}` (admin). Solo se aplican cambios REALES; si no hay cambio
  real → 200 sin tocar la base (cubre "reenviar lo propio" y `{}`); cambio real sobre uno mismo
  → 403. e2e en archivo propio `users-update.e2e-spec.ts` (no en `users.e2e`, para no mezclar estado).
- 16/11 · 002-T8: Swagger con `addBearerAuth` (esquema `bearer`); `@ApiAuthenticated()` (401) y
  `@ApiAdminOnly()` (401+403) reemplazan a `@ApiWriteOperation`. X-API-Key ya no aparece.
  `docs.e2e`: 25 operaciones (20 catálogo + login + 4 usuarios).
- 16/11 · 002-T9: `protection.e2e` recorre el OpenAPI (inventario de las 25 operaciones): toda no
  pública → 401 sin credencial; toda no pública salvo `/users/me` → 403 a un viewer; la doc
  coincide con la realidad. Mutaciones verificadas: sin `@Roles` en un DELETE → detectado;
  `@Public` por error en `GET /users` → detectado (y el `RolesGuard` igual devolvía 401).
  Historial revisado: ningún `.env` ni secreto con valor commiteado. README actualizado.

- 16/11 · 005-T1: gate en `vitest.config.ts` (`include` src/**, `exclude` *.spec.ts, 75/75,
  `json-summary`). Mutaciones (todas código 1): umbral líneas 80 con 246 tests verdes; ramas 81;
  un test roto temporal con cobertura alta. `main.ts` y `artists.controller.ts` figuran con 0%.
  El "1548 líneas" de la cobertura e2e era Vitest contando los `*.spec.ts` como código.
- 16/11 · 005-T2: `test/contract/` = `shapes.ts` (formas a mano + `checkResponse`), `contract-case.ts`
  (tipos + contexto; no estaba en el plan, separa tipos de datos), `catalog.cases.ts` (fábrica por
  recurso: 85 casos = 84 pares del catálogo + `GET /`) y `contract.e2e-spec.ts` (`it.each`).
  `/docs-json` documenta **26** operaciones (incluye `GET /`), no 25. Mutaciones detectadas (4 casos
  c/u): sin `ImageUrl` en artista; `UnitPrice` como texto; `POST /genres` con 200. Cobertura igual.
- 16/11 · 005-T3: `users.cases.ts` (19 casos: login, me, listado, alta, PATCH) + inventario contra
  `/docs-json` (faltantes y casos huérfanos; el de huérfanos también protege contra un inventario
  vacío). NO se fija la cantidad de operaciones: TP-3/TP-4 tendrían que modificar el test. Al
  agregar un endpoint, el inventario exige sus casos. Mutaciones: `@ApiNotFound` en `POST /genres`
  → falla "POST /api/v1/genres · 404"; sin los casos de usuarios → lista los 19 pares.
- 16/11 · 005-T4 **BUG 1** (rojo `1c9e6c3` → arreglo `005-T4`). Síntoma: `?skip=<20 dígitos>` → 500
  en los 5 listados; `<400 dígitos>` → 400. Causa: el DTO dejaba pasar 1e20 y TypeORM lo escribe
  como `OFFSET 100000000000000000000` (> 2^63 → SQLite "datatype mismatch"); 400 dígitos → `Infinity`.
  Arreglo: `toStrictInteger` topa en `Number.MAX_SAFE_INTEGER` (mismo resultado `[]`). Rojo: 2 unit +
  6 e2e (`pagination-limits.e2e-spec.ts`), solo los nuevos. Cobertura: 146/49 sin cubrir (igual).
- 16/11 · 005-T5 **BUG 2** (rojo `e485fe1` → arreglo `005-T5`). Síntoma: "CANCIÓN ÑANDÚ" tras "Canción
  Ñandú" → 201 (también el artista real "ANTÔNIO CARLOS JOBIM"). Causa: `LOWER()` de SQLite solo
  convierte A–Z. Arreglo: `src/database/sql-functions.ts` (`unicode_lower` = `toLowerCase`,
  determinística) registrada en `prepareDatabase`; `existsWithName` de artistas y géneros la usa.
  OJO al escribir rojos de este bug: la letra no ASCII tiene que CAMBIAR de caja ("Émile"/"ÉMILE" no
  sirve) y cada test necesita nombres propios (un duplicado creado por el bug hace pasar a otro test).
  `NOTHING` es palabra reservada de SQLite. Verificado con la app real. Cobertura: 146/49 (igual).
- 16/11 · 005-T6 **BUG 3** (rojo `900e74d` → arreglo `005-T6`). Síntoma: `ImageUrl`/`Composer`/
  `full_name` = `"   "` o `""` se guardaban `""`. Causa: `@Trim()` deja `""` y `@IsOptional()` solo
  omite `null`/`undefined`. Arreglo: `@TrimToNull()` (recorta; vacío → `null`) en los 7 opcionales
  de texto; los obligatorios siguen con `@Trim()` (`""` → 400). Rojo: 14 unit (7 campos × 2 valores)
  + 4 e2e que releen lo guardado. Cobertura: 146/49 (igual).
- `git checkout` de un archivo deja CRLF y Prettier lo marca; su contenido es igual al del repo.
  No commitearlo "arreglado": restaurarlo con `git checkout` y dejarlo afuera.
- 16/11 · 005-T7: `src/common/patch/assign-defined.ts` (copia lo ≠ undefined; null sí) en los
  `update()` de artistas, álbumes, géneros y pistas; verificaciones previas sin mover. Commit SIN
  archivos de test. Sin cubrir: líneas 146 → 144, ramas 49 → 43 (líneas 76,88 %, ramas 81,77 %).

- 16/11 · 006-T1: script `typecheck` (= el `tsc --noEmit` de siempre) y `packageManager:
  pnpm@12.6.0`. pnpm 12 escribe en el lockfile una sección `packageManagerDependencies` con su
  propia versión e integridad (158 líneas): NO es dependencia de la app; se commitea para que el
  install congelado de CI coincida. Mutación: error de tipos en `test/` → `typecheck` sale 2.
- 16/11 · 006-T2: `.github/workflows/ci.yml` (raíz). 1.ª corrida, push de `7ab5890`: **verde en
  47 s**, 7 gates separados, artefacto `cobertura` — github.com/SoftwareSegundo2026/
  Alexis-Napoli-Programacion/actions/runs/43884819522. Re-ejecución (intento 2): cache restaurada
  (65 MB, último uso 14:26; guardado 5 s → 0 s). Permisos del token: `Contents: read`, `Metadata:
  read` (captura `docs/evidencias/006-permisos-token.png`). Sin parser YAML local: la validación es
  la corrida. Logs de Actions vía API exigen admin; estado, pasos, caches y artefactos no.
- 16/11 · 006-T3: regla clásica en `main` (PR obligatorio sin aprobaciones, `gates` requerido, "Do
  not allow bypassing"); API de la rama: `protected: true`, `contexts: [gates]`, `enforcement_level:
  everyone`. **PR #1** (rama `tp-6-evidencia-rojo`, test intencional `1 + 1 = 3`): corrida
  43891474309 → Lint/Build ✅, Unit tests ❌, E2E/Cobertura/Typecheck/artefacto skipped; botón de
  merge deshabilitado siendo admin; PR cerrado sin mergear. La UI nueva ya no escribe "Merging is
  blocked" (botón gris = bloqueo). La API sin token da `mergeable_state: unstable` (no evalúa la
  regla): NO usarla como prueba. Capturas: `docs/evidencias/006-*.png`.
- 16/11 · 006-T4: sección "Integración continua (TP-6)" en `nestjs-tp/README.md` (pasos, cómo leer
  un fallo, protección, evidencia). PR #2 (solo docs) → corrida 43892800709 verde (caso 2).
  Búsqueda de secretos (validate): único `.env*` = `.env.example` vacío; 0 tokens en el historial.
- **`main` está protegida: TODO entra por RAMA + PR que mergea el usuario** (spec 006 RF-9).
- 16/11 · 003 plan: medición sobre COPIA de la base — índice temporal en precio/duración solo
  mejora precio exacto (~0,18 ms); SQLite lo descarta en rangos amplios → sin índices nuevos.
- 16/11 · 003-T1: `common/dto/page.dto.ts` (`Page<T>` + `toPage`: hasMore en un solo lugar);
  `toStrictInteger` exportada; `toStrictDecimal` (`^\d+(\.\d{1,2})?$`); `@IsNotLessThan` (usa
  `Reflect.get`, sin cast); `SearchTracksQueryDto` hereda skip/limit. Parámetro repetido → lista →
  falla su regla de tipo → 400. 41 tests; mutación sin `@IsNotLessThan` → falla su test.
  Cobertura 144/43 sin cubrir (igual).
- 16/11 · 003-T2: `escapeLike` + `TracksRepository.search` (QueryBuilder, LEFT JOIN, parámetros
  nombrados, mapa fijo `SORT_COLUMNS`, `offset/limit` + `getManyAndCount`). Test contra copia REAL
  con ORÁCULO en memoria + `RecordingLogger` (SQL con LIMIT/OFFSET, COUNT aparte, `q` solo en
  parámetros). El oráculo halló un BUG: `orderBy('track.id' DESC)` + `addOrderBy('track.id' ASC)`
  → TypeORM indexa el orden por columna y el 2.º pisa al 1.º; desempate solo si sort ≠ trackId.
  Chinook YA tiene "100% HardCore" (no asumir que una búsqueda solo trae lo sembrado).
  Cobertura: 135/42 sin cubrir (antes 144/43).
- 16/11 · 003-T3: `TracksService.search` (→ `toPage`), `@Get('search')` ANTES de `:id` (en rojo,
  "search" caía en `:id` → 400), `TrackSearchPageDto` (Swagger no documenta genéricos), forma
  `page` en `shapes.ts` + 2 casos de contrato. **Tests viejos ACTUALIZADOS (no borrados ni
  debilitados)** porque fijaban la cantidad de operaciones: `protection.e2e` (+`GET
  /tracks/search` en PUBLIC_OPERATIONS, que exige cambio de spec: lo es la 003; 25 → 26) y
  `docs.e2e` (catálogo 20 → 21, total 25 → 26). Cobertura 143/42 (+8 líneas: controller sin
  unit test, cubierto por e2e); 78,56% ≥ 75.
- 16/11 · 003-T4: `test/tracks-search.e2e-spec.ts` (31 tests: los 21 casos de la spec + variantes,
  y RF-12: `/docs-json` declara los 11 parámetros con su tipo). Datos propios creados por la API en
  `beforeAll` (total esperado = 3503 + 7). Mutación sin `escapeLike` → falla el caso 5 (e2e) y 3
  tests del repository. `typecheck` atrapó un error de tipos en `it.each` que Vitest dejó pasar.
- 16/11 · 003-T5 (**hallazgo de la validación**): el driver de SQLite de TypeORM
  (`AbstractSqliteDriver.escapeQueryWithParameters`) escribe como LITERAL todo parámetro `number`
  → `"GenreId" = 7`. Arreglo: valor como texto + `CAST(? AS INTEGER|REAL)`; EXPLAIN igual (sigue
  usando IFK_TrackGenreId / IFK_AlbumArtistId). `LIMIT/OFFSET` los escribe SIEMPRE el
  QueryBuilder (RNF-3 precisado). Test nuevo con 7 filtros: ningún valor en el SQL. OJO en
  TP-4: los demás repositories (findById, etc.) también inlinean ids numéricos (fuera del TP-3).

## Decisiones del plan 002 a recordar en las próximas tareas
- Guards globales (`APP_GUARD`, autenticación → roles); lo público con `@Public()`.
- Error de JSON **diferido**: `useBodyParser` + manejador que lo anota + interceptor después
  de los guards → 401 → 403 → 400. Los e2e de JSON roto pasan a `POST /genres`.
- Estado y rol se leen de la base en cada petición; `sub` = `user_id`.
- `HashedPassword` con `select: false`; altas de usuarios serializadas.
- Migrar (no borrar) los tests del TP-1: `withKey` → credencial de admin de prueba.

## Aprendizajes y errores a evitar
- `ConfigModule.forRoot({ validate })` valida al **importar** `app.module`, no en `init()`;
  `ConfigService.get` prioriza lo que devolvió `validate` sobre `process.env`.
- pnpm 12 bloquea scripts nativos: `allowBuilds` en `pnpm-workspace.yaml`.
- TypeORM reintenta 9 veces si la base falla: `retryAttempts: 0` para SQLite local.
- El lector del cuerpo de Express corre **antes** que guards y pipes.
- En PowerShell, pnpm y git escriben en stderr aunque salgan bien: mirar `$LASTEXITCODE`.
- Prettier solo sobre archivos propios (sobre `src/` entero reescribe los de la base).
- NUNCA reescribir archivos con `Get-Content`/`WriteAllText` de PowerShell 5.1: lee UTF-8 como ANSI
  y rompe los acentos (pasó en 002-T8; restaurado con `git checkout`). Usar la herramienta Edit.
- Si un e2e falla al levantar la app, su base temporal puede quedar en `%TEMP%`: inofensivo.
- Target ES2023: los campos de clase EXISTEN aunque valgan `undefined` → para "no viaja el hash"
  comprobar el valor y `JSON.stringify`, no `toHaveProperty`.

## Próximos pasos
- TP-6 (CI): workflow en `.github/workflows/` de la RAÍZ con `working-directory: nestjs-tp`; correr
  los 5 gates (incluido `pnpm test:cov`). Branch protection: el usuario configura y saca captura.
- Pendiente para el TP-4: test de modificaciones concurrentes (observación de `001/validate.md`).
- TP-3/TP-4: el inventario del contrato exigirá casos para cada endpoint nuevo; mantener 75/75.
- Pendiente para el TP-4: test de modificaciones concurrentes (observación de `001/validate.md`).
