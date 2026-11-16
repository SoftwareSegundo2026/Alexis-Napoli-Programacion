# MEMORY.md — TP NestJS

Memoria del proyecto entre sesiones. Máximo ~50 líneas. Se actualiza al terminar **cada tarea**.

## Estado actual
- TP-1 (`001-chinook-nest`) **cerrado, validado y pusheado** (`91124e0`).
- TP-2 (`002-auth-roles`): **T1–T9 hechas**; siguiente: `/sdd-validate 002-auth-roles`.
- Tests: `pnpm test` 246 (29 archivos) y `pnpm test:e2e` 254 (13 archivos) en verde; lint sin avisos;
  `pnpm exec tsc --noEmit -p tsconfig.json` también limpio (chequea los tipos de `test/`).

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
- `/sdd-validate 002-auth-roles` → `specs/002-auth-roles/validate.md`; después TP-5.
- Pendiente para el TP-4: test de modificaciones concurrentes (observación de `001/validate.md`).
