VEREDICTO: APROBADO

# Validación 002 — Autenticación y autorización con roles (TP-2)

Fecha: 16/11/2026 · Rol: reviewer (solo lectura: no se modificó código durante la validación)
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `docs/constitution.md`,
`consignas/TP2-autenticacion-y-roles.md`, `git log`.

## Gates (ejecutados en esta validación)

| Gate | Comando | Resultado |
|---|---|---|
| Lint | `pnpm lint` | ✅ exit 0, 0 avisos |
| Build | `pnpm build` | ✅ exit 0 |
| Unit | `pnpm test` | ✅ 246/246 (29 archivos) |
| e2e | `pnpm test:e2e` | ✅ 254/254 (13 archivos) |
| Tipos (extra) | `pnpm exec tsc --noEmit -p tsconfig.json` | ✅ exit 0 (incluye `test/`) |

Sin tests omitidos (`skip`/`only`/`todo`), sin `any` ni `@ts-ignore` en `src/` ni `test/`.

## Requisitos funcionales → tests → resultado

| RF | Qué exige | Tests | Resultado |
|---|---|---|---|
| RF-1 | Login correcto → 200 con credencial firmada que vence; username sin mayúsculas/espacios | `auth.service.spec` › "credenciales correctas → … vence en 30 min" · `auth.e2e` › "responde 200 con access_token y token_type", "la credencial obtenida sirve", "el username no distingue mayúsculas" · `users.repository.spec` › "busca por username sin distinguir…" | ✅ |
| RF-2 | Mismo 401 para inexistente / contraseña mala / deshabilitado; 400 por cuerpo | `auth.service.spec` › casos 1, 2, 11 · `auth.e2e` › "credenciales incorrectas: siempre el mismo 401" (5) y "cuerpo inválido → 400" (6) | ✅ |
| RF-3 | Sin credencial, vencida, alterada, mal formada o de usuario inexistente → 401 `Could not validate credentials` | `auth.service.spec` › authenticate (11 casos, `JwtService` real) · `security.e2e` › 12 rutas × sin credencial / alterada / vacía, vencida · `protection.e2e` › "toda operación NO pública responde 401" | ✅ |
| RF-4 | Usuario deshabilitado con credencial vigente → 401 `Inactive user`; estado leído en cada petición | `auth.service.spec` › caso 3 · `security.e2e` › "credencial vigente de un usuario deshabilitado" · `users-update.e2e` › "la credencial VIGENTE … deja de servir, y vuelve al rehabilitarlo" | ✅ |
| RF-5 | Públicas solo el login, las lecturas del catálogo, la documentación y la página de inicio; lo demás protegido por defecto | `guards.spec` › "@Public pasa sin mirar la credencial", "ruta SIN decorar exige credencial" · `security.e2e` › lecturas públicas (8) y credencial basura ignorada (8) · `protection.e2e` (inventario de las 25 operaciones) · `app-setup.e2e` › "GET /" | ✅ |
| RF-6 | Rol insuficiente → 403 `Admin privileges required`; escrituras y administración solo admin | `guards.spec` › RolesGuard (4) · `security.e2e` › 12 rutas como viewer → 403 · `protection.e2e` › "viewer → 403" en toda operación de admin | ✅ |
| RF-7 | `GET /users/me` con el rol vigente | `users.e2e` › "un viewer ve su perfil…", "un admin ve is_admin: true" | ✅ |
| RF-8 | Listado de usuarios por `user_id`, paginado y validado como el catálogo | `users.repository.spec` › "pagina en la base…" · `users.service.spec` › listado · `users.e2e` › GET /users (3) | ✅ |
| RF-9 | Alta: solo hash con sal; duplicado (sin mayúsculas/espacios) → 409; altas simultáneas → 201 + 409 | `password-hasher.spec` (6) · `users.service.spec` (8, incluida concurrencia) · `users.repository.spec` › índice único → `DuplicateUserError` · `users.e2e` › alta, duplicados (4), simultáneas | ✅ |
| RF-10 | Reglas de datos del alta → 400 que nombra el campo | `user-dto.spec` (18) · `users.e2e` › "→ 400 que nombra el campo" (4) | ✅ |
| RF-11 | `PATCH /users/{id}`: solo lo enviado; 404; lo propio → 403; reenviar lo propio → 200 | `users.service.update.spec` (8) · `update-user-dto.spec` (7) · `users-update.e2e` (12) | ✅ |
| RF-12 | La clave fija del TP-1 ya no se acepta ni se exige | `env.validation.spec` › "WRITE_API_KEY ya no es obligatoria", "se ignora" · `security.e2e` › "la clave fija del TP-1 ya no da acceso" · `docs.e2e` › "ya no la clave X-API-Key" · e2e del TP-1 migrados y en verde | ✅ |
| RF-13 | Documentación con esquema Bearer, marcado en lo protegido, con login y usuarios | `docs.e2e` (14) · `protection.e2e` › "la documentación coincide con la realidad" | ✅ |

## Requisitos no funcionales

| RNF | Evidencia | Resultado |
|---|---|---|
| RNF-1 Sin contraseña, hash ni campos internos de la credencial | `users.repository.spec` (`select: false`) · `user-dto.spec` › UserResponseDto · `auth.service.spec` › "la credencial no lleva la contraseña, el hash ni el rol" · `auth.e2e`, `users.e2e`, `users-update.e2e` (sin `$2b$` ni "password") · `docs.e2e` › esquemas | ✅ |
| RNF-2 Secreto ≥ 32 y duración fuera del repo; sin secreto no arranca | `env.validation.spec` (secreto, duración, costo) · verificación manual: `node dist/main.js` sin secreto o con uno corto → exit 1 con mensaje claro | ✅ |
| RNF-3 Ninguna clave ni contraseña real en el historial | Revisión de `git log --all -p`: ningún `.env` commiteado ni `JWT_SECRET=`/`*_SECRET=` con valor; los tests usan valores de prueba propios (`test/helpers/`) | ✅ |
| RNF-4 Login de inexistente o deshabilitado verifica igual contra un hash de referencia | `auth.service.spec` › "verifica igual contra la referencia" (casos 2 y 11) · `password-hasher.spec` › "la referencia se arma con el mismo costo" | ✅ |
| RNF-5 Tests sobre copia descartable | `test/setup-e2e.ts`, `database.e2e` (sigue en verde); `users.repository.spec` usa su propia copia temporal | ✅ |

## Casos límite (los 10 de la consigna + 15 propios)

| # | Caso | Test | Resultado |
|---|---|---|---|
| 1 | Contraseña incorrecta → 401 genérico | `auth.service.spec`, `auth.e2e` | ✅ |
| 2 | Usuario inexistente → mismo 401 | `auth.service.spec`, `auth.e2e` | ✅ |
| 3 | Deshabilitado con credencial válida → 401 | `auth.service.spec`, `security.e2e`, `users.e2e`, `users-update.e2e` | ✅ |
| 4 | Credencial vencida → 401 | `auth.service.spec`, `security.e2e` | ✅ |
| 5 | Firma inválida / editada → 401 | `auth.service.spec` (sub editado, otro secreto, `alg: none`), `security.e2e` (12 rutas) | ✅ |
| 6 | Sin `Authorization` → 401 | `auth.service.spec`, `security.e2e`, `protection.e2e` | ✅ |
| 7 | Rol insuficiente → 403 | `guards.spec`, `security.e2e` (12 rutas), `protection.e2e` | ✅ |
| 8 | Username o email repetido → 409 | `users.service.spec`, `users.e2e` (4 variantes) | ✅ |
| 9 | Sin hash ni `iat`/`exp` sueltos en las respuestas | `auth.e2e`, `users.e2e`, `user-dto.spec` | ✅ |
| 10 | Dos logins simultáneos | `auth.e2e` › "dos logins simultáneos…" | ✅ |
| 11 | Login de deshabilitado → mismo 401 | `auth.service.spec`, `auth.e2e`, `users-update.e2e` | ✅ |
| 12 | `Authorization` sin `Bearer`, otro esquema o vacío → 401; `bearer` vale | `auth.service.spec`, `security.e2e` | ✅ |
| 13 | Quitar el rol rige en la siguiente escritura | `users-update.e2e` › "ascender … quitarle el rol lo vuelve a impedir" | ✅ |
| 14 | Admin no se quita el rol ni se deshabilita; reenviar lo propio → 200 | `users.service.update.spec`, `users-update.e2e` | ✅ |
| 15 | Sin credencial + JSON malformado en escritura protegida → 401 | `security.e2e`, `app-setup.e2e` | ✅ |
| 16 | Viewer con cuerpo inválido → 403 | `security.e2e` (cuerpo inválido y JSON malformado), `users-update.e2e` | ✅ |
| 17 | `hashed_password` en el alta → 400; la respuesta nunca lo trae | `user-dto.spec`, `users.e2e` | ✅ |
| 18 | `PATCH /users/{id}` con `{}` → 200 | `users.service.update.spec`, `users-update.e2e` | ✅ |
| 19 | Contraseña de 73+ → 400 | `user-dto.spec`, `users.e2e` | ✅ |
| 20 | Login con JSON malformado → 400 | `auth.e2e` | ✅ |
| 21 | Login con otras mayúsculas o espacios → 200 | `auth.e2e`, `users.repository.spec` | ✅ |
| 22 | Credencial inválida en endpoint público → se ignora | `guards.spec`, `security.e2e` (8 rutas), `auth.e2e` | ✅ |
| 23 | Dos altas simultáneas iguales → 201 + 409 | `users.service.spec` (verificado por mutación), `users.e2e` | ✅ |
| 24 | Todo 401 trae `WWW-Authenticate: Bearer` | `detail-exception.filter.spec`, `security.e2e`, `auth.e2e` | ✅ |
| 25 | La clave fija `X-API-Key` → 401 | `security.e2e` | ✅ |

## Criterios de finalización

- [x] Cada RF y cada uno de los 25 casos límite tiene al menos un test que pasa.
- [x] Los tests del TP-1 siguen pasando, migrados de la clave a la credencial de admin (detalle de la
  migración en `MEMORY.md`, entrada 002-T4).
- [x] Los 4 gates en verde.
- [x] Consigna: "el que olvida decorar un endpoint lo descubre con un test de regresión" →
  `protection.e2e`, verificado con dos mutaciones (un `@Roles` olvidado y un `@Public` indebido).

## Proceso

| Verificación | Resultado |
|---|---|
| Fases en orden con aprobación | spec + clarify (`f235da4`) → plan + tasks (`acfe728`) → T1…T9 |
| Un commit por tarea | T1 `e8125f0` · T2 `49691e9` · T3 `45e532c` · T4 `0ebb442` · T5 `abb3ab7` · T6 `b8abb83` · T7 `3954b45` · T8 `9da38c5` · T9 `6180a45` |
| Tareas `[x]` con gates en verde | 9/9 |
| `MEMORY.md` por tarea | Sí, en los 9 commits |
| Tests borrados | Ninguno sin reemplazo: `write-key.middleware.spec` se eliminó junto con el middleware (RF-12); sus 13 casos quedaron cubiertos por tests nuevos (mapeo en `MEMORY.md`) |
| Desvíos del plan | Documentados: `PasswordHasher` en `users/` (evita dependencia circular, plan actualizado en T2); e2e del PATCH en archivo propio (T7) |

## Constitución

| Principio | Observación |
|---|---|
| 1. La spec manda | Solo lo de la spec 002; fuera de alcance respetado (sin refresh tokens, sin autoregistro, sin auditoría). |
| 2. Tests como puerta | Tests primero en cada tarea; rojo verificado; mutaciones en T6 y T9. |
| 3. Capas | Controllers sin lógica; reglas en `AuthService`/`UsersService`; TypeORM solo en repositories. |
| 4. TS estricto | Sin `any` ni `@ts-ignore`; chequeo de tipos también sobre `test/`. |
| 5. Seguridad | Hash con sal (bcrypt), contraseña nunca en respuestas, secretos fuera del repo, protegido por defecto (guards globales + regresión). |
| 6. Idioma | Código en inglés; documentación y comentarios en español; `detail` en inglés por paridad con el original. |

## Observaciones (no bloquean)

1. **Sin límite de intentos de login:** declarado fuera de alcance en la spec; es la protección
   natural contra fuerza bruta en un sistema real.
2. **Una consulta a la base por petición protegida** para leer estado y rol (plan, decisión 3): es
   el costo de que deshabilitar o quitar el rol rija en el acto.
3. **`LOWER()` de SQLite solo normaliza ASCII** también para usernames y emails (heredado del TP-1).
