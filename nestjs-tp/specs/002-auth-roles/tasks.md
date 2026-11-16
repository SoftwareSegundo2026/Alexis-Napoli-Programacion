# Tareas 002 — Autenticación y autorización con roles (TP-2)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/002-auth-roles/plan.md` (aprobado el 16/11)

Reglas: una tarea por vez, tests primero (en rojo), gates
`pnpm lint && pnpm build && pnpm test && pnpm test:e2e` en verde, un commit
`002-Tn: …`, `[x]` acá y `MEMORY.md` actualizado. Después, **PARA**.

- [x] **T1. Dependencias y configuración.** RNF-2
      `@nestjs/jwt` y `bcryptjs`; `JWT_SECRET` obligatorio (≥ 32 caracteres),
      `JWT_EXPIRES_MINUTES` (30 por defecto), `PASSWORD_HASH_ROUNDS` (12 por defecto);
      `.env.example` y entorno de los e2e. `WRITE_API_KEY` sigue hasta la T4.
      Hecho cuando: `pnpm test` pasa los tests de `env.validation` (secreto ausente, corto o
      solo espacios → error claro; defaults 30 y 12; valores inválidos → error).
      Estimación: 20 min · depende de: —

- [x] **T2. Persistencia de usuarios y hash.** RF-9 (parcial), RNF-1
      Entidad `User` (tabla existente, `HashedPassword` con `select: false`), `UsersRepository`
      (página por id, búsqueda sin mayúsculas/espacios, existencia de username/email, alta con
      traducción del índice único) y `PasswordHasher` (hash, verificar, verificar contra el
      hash de referencia).
      Hecho cuando: `pnpm test` pasa los tests del repository (consultas con mock) y del
      hasher (hash con sal distinto cada vez, verifica bien/mal, lee un hash `$2b$` existente).
      Estimación: 25 min · depende de: T1

- [x] **T3. Núcleo de autenticación (sin conectar todavía).** RF-1–RF-6, RNF-4
      `AuthService` (`login`, `issueToken`, `authenticate`), guards de autenticación y de roles,
      decoradores `@Public`, `@Roles`, `@CurrentUser`. No se registran globalmente aún.
      Hecho cuando: `pnpm test` pasa los tests de `AuthService` (casos 1, 2, 4, 5, 11, 12, 21 y
      RNF-4: la verificación ficticia se ejecuta) y de los guards (público ignora credencial,
      sin credencial → 401, inactivo → 401, rol insuficiente → 403, admin pasa).
      Estimación: 30 min · depende de: T2

- [x] **T4. Conmutación: guards globales y migración del TP-1.** RF-3–RF-6, RF-12
      Registrar los guards como `APP_GUARD`; lector de JSON diferido + interceptor; header
      `WWW-Authenticate` en el filtro; `@Public`/`@Roles('admin')` en el catálogo y `GET /`;
      eliminar el middleware de la clave y `WRITE_API_KEY`; migrar los tests del TP-1 a la
      credencial (helper `test/helpers/auth.ts` con usuarios sembrados).
      Hecho cuando: `pnpm test:e2e` pasa `security.e2e-spec.ts` migrado (casos 4–7, 12, 15, 16,
      22, 24, 25) y **todos** los e2e del TP-1 siguen pasando con la credencial de admin.
      Estimación: 30 min · depende de: T3

- [x] **T5. Login.** RF-1, RF-2, RNF-1, RNF-4
      `POST /auth/token` público, DTO de entrada y de salida (`access_token`, `token_type`).
      Hecho cuando: `pnpm test:e2e` pasa `test/auth.e2e-spec.ts` (casos 1, 2, 9, 10, 11, 20, 21:
      200 con credencial usable, 401 genérico, 400 por cuerpo, dos logins simultáneos).
      Estimación: 20 min · depende de: T4

- [x] **T6. Perfil, listado y alta de usuarios.** RF-7–RF-10, RNF-1
      `GET /users/me`, `GET /users` (admin, paginado), `POST /users` (admin; duplicados → 409;
      altas serializadas).
      Hecho cuando: `pnpm test` pasa los tests de `UsersService` y de los DTOs, y `pnpm test:e2e`
      pasa `test/users.e2e-spec.ts` en lo de alta/listado/perfil (casos 8, 9, 17, 19, 23).
      Estimación: 30 min · depende de: T5

- [x] **T7. Modificación de usuarios.** RF-11, RF-4, casos 3, 13, 14, 18
      `PATCH /users/{id}` (admin): solo `disabled`/`is_admin`; lo propio → 403; valor propio → 200.
      Hecho cuando: `pnpm test:e2e` pasa la parte de modificación de `users.e2e-spec.ts`,
      incluido "deshabilitar corta el acceso de una credencial vigente" y "quitar el rol → 403
      en la siguiente escritura".
      Estimación: 25 min · depende de: T6

- [x] **T8. Documentación con Bearer.** RF-13
      Esquema `Bearer` en Swagger, marcado en lo protegido, login y usuarios documentados.
      Hecho cuando: `pnpm test:e2e` pasa `docs.e2e-spec.ts` migrado (25 operaciones; las
      protegidas declaran `Bearer` y las públicas no; esquema `UserResponseDto` sin hash).
      Estimación: 20 min · depende de: T7

- [x] **T9. Regresión de protección y cierre.** RF-5, RNF-3
      `test/protection.e2e-spec.ts`: recorre el documento OpenAPI y exige 401 sin credencial en
      toda operación no pública; control de secretos en `git log`; README y `MEMORY.md`.
      Hecho cuando: `pnpm test:e2e` pasa `protection.e2e-spec.ts` y
      `pnpm lint && pnpm build && pnpm test && pnpm test:e2e` quedan en verde.
      Estimación: 20 min · depende de: T8

---

Después de T9: `/sdd-validate 002-auth-roles` (tabla RF/casos → test → resultado + veredicto).
