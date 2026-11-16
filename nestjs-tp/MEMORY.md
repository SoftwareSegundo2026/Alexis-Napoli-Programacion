# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- TP-1 (`001-chinook-nest`) **cerrado, validado y pusheado** (`91124e0`).
- TP-2 (`002-auth-roles`) **cerrado**: T1–T9 y `validate.md` → APROBADO.
- TP-5 (`005-calidad`) **en curso**: spec, clarify, plan y tareas aprobados; **cerrado**: T1–T7 y `validate.md` → APROBADO (pusheado).
- TP-6 (`006-ci`) **en curso**: spec, clarify, plan y tareas aprobados; T1–T2 cerradas. Siguiente: T3.
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
- **Desde que `main` quede protegida (TP-6 T3): todo por RAMA + PR** (spec 006 RF-9).

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
