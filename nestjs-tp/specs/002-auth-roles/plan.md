# Plan 002 — Autenticación y autorización con roles (TP-2)

Estado: **aprobado** (16/11, Alexis Napoli — incluye las 2 dependencias nuevas) · Spec: `specs/002-auth-roles/spec.md` (aprobada el 16/11, clarify ronda 2)

## Dependencias nuevas (requieren aprobación — AGENTS.md)

| Paquete | Para qué | RF |
|---|---|---|
| `@nestjs/jwt` ^12.0.5 | Firmar y verificar la credencial (JWT HS256 con vencimiento) | RF-1, RF-3, RF-4 |
| `bcryptjs` ^3.0.3 | Hash con sal de contraseñas; JS puro (sin compilar), lee los hash `$2b$` que ya tiene la base. Es lo que recomienda el plan de migración del docente. Trae sus tipos. | RF-9, RNF-4 |

No hace falta Passport: el guard propio deja ver todo el flujo (también lo recomienda el docente).

## Estructura de módulos (lo nuevo y lo que cambia)

```
src/
├── auth/
│   ├── auth.module.ts               ← JwtModule + registra los guards GLOBALES (APP_GUARD)
│   ├── auth.controller.ts           ← POST /auth/token (@Public)
│   ├── auth.service.ts              ← login (con verificación ficticia, RNF-4), emitir y verificar credencial
│   ├── password-hasher.ts           ← hash / verificar / verificar contra hash de referencia
│   ├── guards/authentication.guard.ts ← 401 (RF-3, RF-4); ignora la credencial en lo @Public
│   ├── guards/roles.guard.ts        ← 403 según @Roles (RF-6)
│   ├── decorators/public.decorator.ts, roles.decorator.ts, current-user.decorator.ts
│   ├── interceptors/body-parse-error.interceptor.ts ← lanza el 400 del JSON malformado DESPUÉS de los guards
│   └── dto/login.dto.ts, token-response.dto.ts
├── users/
│   ├── users.module.ts, users.controller.ts, users.service.ts, users.repository.ts
│   ├── entities/user.entity.ts      ← tabla `User` existente (HashedPassword con select: false)
│   └── dto/create-user.dto.ts, update-user.dto.ts, user-response.dto.ts
├── common/filters/detail-exception.filter.ts ← + header WWW-Authenticate en todo 401
├── common/middleware/write-key.middleware.ts  ← SE ELIMINA (RF-12); su spec se migra (ver abajo)
├── config/env.validation.ts         ← − WRITE_API_KEY; + JWT_SECRET, JWT_EXPIRES_MINUTES, PASSWORD_HASH_ROUNDS
├── app.setup.ts                     ← lector de JSON "diferido" + interceptor + Swagger con Bearer
└── <catálogo>/*.controller.ts       ← @Public en los GET, @Roles('admin') en POST/PATCH/DELETE
test/
├── helpers/auth.ts                  ← siembra usuarios de prueba y emite credenciales
├── auth.e2e-spec.ts, users.e2e-spec.ts, protection.e2e-spec.ts (regresión: nada queda sin proteger)
└── security.e2e-spec.ts, docs.e2e-spec.ts, app-setup.e2e-spec.ts y los 4 del catálogo ← migrados
```

## Archivos y responsabilidad

| Archivo | Qué hace | RF / RNF |
|---|---|---|
| `auth/auth.service.ts` | `login`: busca por username (sin mayúsculas ni espacios), verifica la contraseña; si el usuario no existe o está deshabilitado verifica igual contra el hash de referencia y responde el mismo 401. `issueToken`: `{ sub: <user_id> }`, HS256, vence en `JWT_EXPIRES_MINUTES`. `authenticate(header)`: esquema `Bearer` (sin mayúsculas), firma, vencimiento, usuario existente → 401 `Could not validate credentials`; deshabilitado → 401 `Inactive user` | RF-1–RF-4, RNF-4 |
| `auth/guards/authentication.guard.ts` | Global. Si la ruta es `@Public` deja pasar sin mirar la credencial; si no, `authenticate` y deja el usuario en la petición | RF-3–RF-5 |
| `auth/guards/roles.guard.ts` | Global, después del anterior. Si la ruta declara `@Roles('admin')` y el usuario (rol leído de la base en esta petición) no lo tiene → 403 `Admin privileges required` | RF-6 |
| `auth/interceptors/body-parse-error.interceptor.ts` | Si el JSON del cuerpo estaba roto, lanza el 400 recién ahora (después de 401/403) | prioridad, casos 15, 16, 20 |
| `app.setup.ts` | Registra el lector de JSON antes que Nest (`useBodyParser`) y, detrás, un manejador que **anota** el error de JSON en la petición en lugar de responder | prioridad |
| `users/users.service.ts` | Alta: duplicados (409), hash, **altas serializadas** (una a la vez); modificación: solo `disabled`/`is_admin`, regla "no lo propio" (403), valor propio sin cambio → 200 | RF-8–RF-11 |
| `users/users.repository.ts` | DAO: página por `user_id`, búsqueda sin mayúsculas, existencia de username/email, alta (traduce la violación de índice único a 409 como red de seguridad) | RF-8, RF-9, RNF-1 |
| `users/dto/user-response.dto.ts` | `fromEntity()`: `user_id, username, email, full_name, disabled, is_admin` y nada más | RNF-1 |
| `common/filters/detail-exception.filter.ts` | Agrega `WWW-Authenticate: Bearer` cuando el código es 401 | caso 24 |

## Decisiones (y por qué), contra la constitution

1. **Guards globales y "público por excepción"** (principio 5). El guard de autenticación
   y el de roles se registran como `APP_GUARD`: una ruta nueva sin decorar queda
   protegida. Lo público se marca con `@Public()` y el rol con `@Roles('admin')`, por
   decorador en cada endpoint (pregunta 1 de la consigna).
2. **Se reemplaza el middleware del TP-1 por guards.** En el TP-1 la clave era un
   middleware porque tenía que correr antes del lector del cuerpo (401 antes que 400).
   Con roles eso ya no alcanza: el rol que pide cada ruta solo se conoce en los guards,
   y el lector del cuerpo corre antes. Solución: **diferir el error de JSON**. El lector se
   registra primero; un manejador detrás guarda el error en la petición y deja seguir;
   un interceptor (que en Nest corre después de los guards) lo lanza como 400. Así la
   prioridad 401 → 403 → 400 de la spec se cumple también con JSON malformado, y el
   login (público) responde 400 (RF-2). No suma dependencias.
3. **El estado y el rol se leen de la base en cada petición** (RF-4, caso 13). La
   credencial solo dice quién es (`sub` = `user_id`); deshabilitar o quitar el rol rige en
   la petición siguiente. Costo: una consulta por petición protegida (aceptable acá).
4. **Mismo 401 y mismo trabajo en el login fallido** (RF-2, RNF-4). Si el usuario no
   existe o está deshabilitado se verifica igual contra un hash de referencia creado al
   arrancar con el mismo costo, para no delatar la cuenta por el tiempo de respuesta.
5. **`HashedPassword` con `select: false`** (RNF-1, principio 5). La entidad no carga el
   hash salvo que el login lo pida a propósito; aunque alguien devolviera la entidad,
   el hash no viaja. Además la salida siempre pasa por `UserResponseDto`.
6. **Altas serializadas** (RF-9, caso 23). El alta (comprobar duplicado → hash → guardar)
   corre de a una por vez dentro del proceso; dos altas iguales simultáneas dan 201 y
   409. El índice único de la base queda como red de seguridad (se traduce a 409).
7. **Costo del hash configurable** (`PASSWORD_HASH_ROUNDS`, por defecto 12 como los
   hash existentes). Los tests usan 4 para no tardar minutos; producción no cambia.
8. **Migración de los tests del TP-1, sin borrar casos** (RF-12, criterio de
   finalización). `withKey` pasa a enviar la credencial de un admin de prueba; los casos
   "sin clave / clave incorrecta / clave vacía" pasan a "sin credencial / alterada /
   vacía". `write-key.middleware.spec.ts` se reemplaza por los tests del guard con los
   mismos casos (GET libre, escrituras sin credencial → 401, credencial correcta pasa).
   Los e2e de JSON malformado se mueven de una ruta inexistente a `POST /genres`, porque
   con el error diferido una ruta inexistente responde 404.
9. **Usuarios de prueba propios.** Los e2e siembran `test_admin`, `test_viewer` y
   `test_disabled` con contraseñas de prueba en su copia de la base; no dependen de las
   contraseñas reales del template ni las escriben en el repo (RNF-3).

## Estrategia de tests

| Tanda | Tipo | Qué cubre |
|---|---|---|
| A | unit — `env.validation` | RNF-2 (secreto ausente o corto, duración por defecto) |
| B | unit — `PasswordHasher`, `AuthService` (repo y JWT simulados) | RF-1–RF-4, RNF-4 (la verificación ficticia se ejecuta), casos 1–5, 11, 12, 21 |
| C | unit — guards e interceptor | RF-5, RF-6, prioridad (casos 15, 16, 22) |
| D | unit — `UsersService`, `UsersRepository`, DTOs | RF-8–RF-11, casos 8, 14, 17–19, 23 |
| E | e2e — `auth.e2e` | login real: casos 1, 2, 9, 10, 11, 20, 21 |
| F | e2e — `users.e2e` | RF-7–RF-11 por HTTP, casos 3, 8, 13, 14, 17–19, 23 |
| G | e2e — `security.e2e` (migrado) + `protection.e2e` | casos 4–7, 12, 15, 16, 22, 24, 25; **regresión**: toda ruta del documento OpenAPI que no sea pública responde 401 sin credencial |
| H | e2e — `docs.e2e` (migrado) | RF-13 |
| — | e2e del TP-1 migrados | la spec 001 sigue vigente (RF-12) |

Credencial vencida en tests: se firma con el secreto de prueba y un `exp` pasado.
Credencial alterada: se cambia un carácter de una válida y se firma otra con otro secreto.

## Riesgos y casos a tener presentes

- Orden de los `APP_GUARD`: autenticación antes que roles (se registran juntos, en ese orden).
- `GET /users/me` declarado antes que rutas con `:id` (hoy solo hay `PATCH /users/:id`).
- `bcryptjs` con costo 12 tarda: por eso `PASSWORD_HASH_ROUNDS` en los tests.
- El template trae usuarios reales con hash: los tests no los usan ni los modifican.
- Columnas `Disabled`/`IsAdmin` son enteros 0/1 en SQLite: mapearlas a booleanos.
- Un `JWT_SECRET` de prueba en `test/` no es un secreto real (documentado).

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

Estimación: 9 tareas — configuración → persistencia de usuarios → núcleo de autenticación
(sin conectar) → conmutación global (guards, migración del TP-1) → login → alta y
listado de usuarios → modificación de usuarios → documentación → regresión y cierre.
