# Spec 002 — Autenticación y autorización con roles (TP-2)

Estado: **aprobada** (16/11, Alexis Napoli — tras clarify ronda 1) · Se apoya en `specs/001-chinook-nest/` (aprobada y validada)

## Contexto y objetivo

El catálogo del TP-1 protege sus escrituras con una clave fija compartida: no se sabe
**quién** escribe, la clave no vence y no hay forma de dar permisos distintos a
personas distintas. Este cambio reemplaza esa clave por **cuentas de usuario con
login**: cada persona se identifica con usuario y contraseña, recibe una credencial
temporal firmada y, según su **rol**, puede o no modificar el catálogo y administrar
usuarios. La seguridad se trata como un requisito más, con sus casos límite
comprobados por tests.

Las cuentas son las de la tabla de usuarios que ya trae la base (con contraseñas
guardadas como hash): no tienen relación con los clientes ni con los empleados de Chinook.

## Usuarios

| Rol | Qué hace |
|---|---|
| Visitante (sin cuenta) | Consulta el catálogo y la documentación; puede iniciar sesión |
| Viewer (usuario con rol `viewer`) | Lo mismo que el visitante, más consultar su propio perfil |
| Admin (usuario con rol `admin`) | Todo lo anterior, más modificar el catálogo y administrar usuarios |

El rol de cada usuario se guarda en su registro: administrador → `admin`; cualquier
otro → `viewer`. Cada operación declara qué rol necesita.

## Historias de usuario

- **HU-1.** Como usuario registrado, quiero iniciar sesión con mi usuario y contraseña,
  para obtener una credencial con la que operar sin volver a escribir la contraseña.
  *Aceptación:* credenciales correctas → 200 con la credencial; incorrectas → 401 (RF-1, RF-2).
- **HU-2.** Como responsable de seguridad, quiero que un fallo de login no revele si
  el usuario existe o si falló la contraseña, para no facilitar la adivinación de cuentas.
  *Aceptación:* usuario inexistente y contraseña incorrecta dan la misma respuesta (RF-2).
- **HU-3.** Como admin, quiero ser el único que modifica el catálogo, para que un
  usuario de solo lectura no pueda alterar datos aunque tenga una sesión válida.
  *Aceptación:* sin credencial → 401; viewer → 403; admin → la operación; la clave fija
  del TP-1 ya no da acceso → 401 (RF-5, RF-6, RF-12).
- **HU-4.** Como admin, quiero dar de alta usuarios, habilitarlos o deshabilitarlos y
  cambiarles el rol, para administrar quién accede y con qué permisos.
  *Aceptación:* alta 201, cambios 200, duplicados 409 (RF-8 a RF-11).
- **HU-5.** Como admin, quiero que deshabilitar a alguien le corte el acceso en el acto,
  aunque tenga una credencial todavía vigente.
  *Aceptación:* credencial vigente de un usuario deshabilitado → 401 (RF-4).
- **HU-6.** Como usuario, quiero consultar mis propios datos, para saber con qué rol estoy operando.
  *Aceptación:* 200 con mi perfil, nunca con datos internos (RF-7, RNF-1).
- **HU-7.** Como visitante, quiero seguir consultando el catálogo sin cuenta, como en el TP-1.
  *Aceptación:* las lecturas del catálogo responden sin credencial (RF-5).
- **HU-8.** Como desarrollador de un cliente, quiero que la documentación interactiva
  explique cómo autenticarme y qué operaciones lo exigen, para probar la API sin leer el código.
  *Aceptación:* la documentación declara el esquema `Bearer`, lo marca en las operaciones
  protegidas e incluye login y usuarios (RF-13).

## Contrato general

- Todas las rutas siguen bajo `/api/v1`; todo error responde `{"detail": "<mensaje>"}`.
- **Login:** `POST /auth/token` con `{"username", "password"}` → 200
  `{"access_token": "<credencial>", "token_type": "bearer"}`. Es el **único endpoint
  público de escritura**.
- La credencial se presenta en cada petición en el header `Authorization: Bearer <credencial>`
  (el nombre del esquema, `Bearer`, no distingue mayúsculas, como indica el estándar HTTP).
- Toda respuesta 401 incluye el header `WWW-Authenticate: Bearer`.
- **Usuarios:** `GET /users` (admin, paginado con `skip`/`limit` igual que el catálogo),
  `GET /users/me` (cualquier usuario autenticado), `POST /users` (admin),
  `PATCH /users/{id}` (admin).
- Campos de un usuario en las respuestas (los del servicio original): `user_id`,
  `username`, `email`, `full_name`, `disabled`, `is_admin`.
- Públicos (sin credencial): el login, las lecturas del catálogo (`GET` de los cuatro
  recursos), la documentación interactiva y la página de inicio. **Todo lo demás exige
  credencial**; lo público se declara de forma explícita, y una operación nueva que no
  se declare pública queda protegida. En una operación pública la credencial, si viene,
  se ignora (no se valida ni provoca errores).
- Prioridad cuando hay varios problemas a la vez: sin credencial o credencial inválida
  (401) → rol insuficiente (403) → datos o id con formato inválido (400) → recurso
  inexistente (404) → conflicto (409).

## Requisitos funcionales (en EARS)

**Sesión**

- **RF-1:** CUANDO un usuario habilitado envía su usuario y contraseña correctos al
  login, EL SISTEMA responde 200 con una credencial firmada que vence después del
  tiempo configurado, y `token_type` igual a `bearer`. El `username` se compara sin
  distinguir mayúsculas ni los espacios de los extremos (coherente con RF-9: no pueden
  existir dos usuarios que difieran solo en eso); la contraseña, exacta.
- **RF-2:** SI el usuario no existe, la contraseña no coincide o el usuario está
  deshabilitado, ENTONCES EL SISTEMA responde 401 con el mismo mensaje en los tres
  casos (`Incorrect username or password`); SI faltan `username` o `password`, no son
  texto o el cuerpo no es JSON válido, ENTONCES responde 400 (el login es público: no
  hay credencial que verificar antes).
- **RF-3:** SI una petición a una operación protegida no trae credencial, trae una
  credencial vencida, con la firma alterada, mal formada o de un usuario que ya no
  existe, ENTONCES EL SISTEMA responde 401 con `Could not validate credentials` (el
  mismo mensaje en todos esos casos) y no ejecuta la operación.
- **RF-4:** SI la credencial es válida pero el usuario está deshabilitado, ENTONCES EL
  SISTEMA responde 401 con `Inactive user` y no ejecuta la operación (el estado y el
  rol se consultan en cada petición, no se confía en lo que diga la credencial).

**Autorización**

- **RF-5:** MIENTRAS una operación esté declarada pública, EL SISTEMA la atiende sin
  credencial; son públicas solo el login, las lecturas del catálogo, la documentación
  y la página de inicio.
- **RF-6:** SI un usuario autenticado sin el rol requerido intenta una operación,
  ENTONCES EL SISTEMA responde 403 con `Admin privileges required` y no la ejecuta; las
  altas, modificaciones y bajas del catálogo y la administración de usuarios requieren
  rol `admin`.
- **RF-7:** CUANDO un usuario autenticado consulta su perfil (`GET /users/me`), EL
  SISTEMA devuelve sus datos con el rol vigente.

**Administración de usuarios**

- **RF-8:** CUANDO un admin consulta el listado de usuarios, EL SISTEMA devuelve los
  usuarios ordenados por `user_id` ascendente, con la misma paginación y las mismas
  validaciones de `skip`/`limit` que el catálogo.
- **RF-9:** CUANDO un admin da de alta un usuario válido, EL SISTEMA guarda la
  contraseña solo como hash con sal y responde 201 con el usuario creado; SI el
  `username` o el `email` ya pertenecen a otro usuario (sin distinguir mayúsculas ni
  espacios en los extremos), ENTONCES responde 409 y no guarda nada. Los valores se
  guardan tal como vienen, recortados. SI llegan dos altas simultáneas con el mismo
  `username` o `email`, ENTONCES exactamente una responde 201 y la otra 409 (nunca dos
  usuarios iguales ni un error 500).
- **RF-10:** SI el alta incumple las reglas de datos (tabla de abajo), ENTONCES EL
  SISTEMA responde 400 con un `detail` que nombra el campo y no guarda nada.
- **RF-11:** CUANDO un admin modifica a otro usuario (`disabled` y/o `is_admin`), EL
  SISTEMA aplica solo lo enviado y responde 200; SI el id no existe, ENTONCES 404; SI
  el admin intenta cambiar su **propio** rol o deshabilitarse a sí mismo, ENTONCES 403
  con `You cannot change your own role or status` y no cambia nada (se informa después
  de validar el cuerpo). Reenviar para sí mismo el
  valor que ya tiene no es un cambio → 200.

**Reemplazo de la clave fija del TP-1**

- **RF-12:** EL SISTEMA ya no acepta la clave fija de escritura de la spec 001 ni exige
  configurarla: la RF-11 de esa spec (y sus casos límite de clave) queda reemplazada
  por RF-3 a RF-6 de esta, y la parte de la RF-14 que declaraba la clave, por RF-13. El
  resto de la spec 001 sigue vigente.
- **RF-13:** CUANDO se solicita la documentación interactiva, EL SISTEMA declara el
  esquema de credencial `Bearer`, marca qué operaciones lo requieren e incluye las
  rutas de login y de usuarios.

| Campo (alta de usuario) | Regla |
|---|---|
| `username` | Obligatorio, texto de 3 a 80 caracteres, sin espacios (solo letras, números, `.`, `_` y `-`) |
| `email` | Obligatorio, formato de email válido, hasta 120 caracteres |
| `password` | Obligatorio, de 8 a 72 caracteres; nunca se devuelve ni se guarda en claro |
| `full_name` | Opcional, hasta 120 caracteres |
| `is_admin` | Opcional, booleano; por defecto `false` (rol `viewer`) |
| Modificación (`PATCH /users/{id}`) | Solo `disabled` e `is_admin`, booleanos, ambos opcionales; cualquier otro campo → 400 |
| Todos | Campos desconocidos → 400. Los textos se recortan en los extremos; solo espacios cuenta como vacío. |

## Requisitos no funcionales

- **RNF-1:** Ninguna respuesta incluye la contraseña, su hash ni los datos internos de
  la credencial (fecha de emisión o de vencimiento como campos sueltos).
- **RNF-2:** El secreto de firma y la duración de la credencial se configuran fuera del
  repositorio; SI el secreto no está configurado o tiene menos de 32 caracteres,
  ENTONCES EL SISTEMA no arranca y muestra un mensaje claro. La duración por defecto
  es de 30 minutos.
- **RNF-3:** Ninguna clave, contraseña real ni credencial aparece en el historial del
  repositorio; los tests usan valores de prueba propios.
- **RNF-4:** CUANDO el login recibe un usuario inexistente o deshabilitado, EL SISTEMA
  igual ejecuta una verificación de contraseña (contra un hash de referencia) antes de
  responder 401, para que el tiempo de respuesta no delate si la cuenta existe.
- **RNF-5:** Los tests siguen trabajando sobre una copia descartable de la base.

## Casos límite (los 10 de la consigna, más los propios)

| # | Situación | Esperado |
|---|---|---|
| 1 | Login con contraseña incorrecta | 401 `Incorrect username or password` |
| 2 | Login con usuario inexistente | 401, mismo mensaje que el caso 1 |
| 3 | Usuario deshabilitado con credencial válida | 401, nunca 200 |
| 4 | Credencial vencida | 401 |
| 5 | Credencial con firma inválida o editada a mano | 401 |
| 6 | Sin header `Authorization` en una operación protegida | 401 |
| 7 | Credencial válida pero rol insuficiente (viewer escribiendo) | 403 |
| 8 | Alta con `username` o `email` ya existentes (con otras mayúsculas o espacios) | 409 |
| 9 | Respuesta de login o de usuario | sin contraseña ni hash, sin campos internos de la credencial |
| 10 | Dos logins simultáneos del mismo usuario | ambos 200 con credenciales válidas |
| 11 | Login de un usuario deshabilitado | 401, mismo mensaje que el caso 1 |
| 12 | Header `Authorization` sin el prefijo `Bearer`, con otro esquema o vacío | 401; `bearer` en minúsculas sí vale |
| 13 | Credencial de un usuario al que después se le quita el rol admin | 403 en la siguiente escritura (rige el rol vigente) |
| 14 | Admin que intenta quitarse el rol o deshabilitarse | 403, sin cambios; reenviar su valor actual → 200 |
| 15 | Sin credencial y con JSON malformado en una escritura **protegida** | 401 (la credencial se verifica primero) |
| 16 | Viewer con cuerpo inválido en una escritura del catálogo | 403 (el rol se verifica antes que los datos) |
| 17 | Alta de usuario con `password` en la respuesta o con un campo `hashed_password` en el cuerpo | la respuesta nunca la trae; el campo desconocido → 400 |
| 18 | `PATCH /users/{id}` con `{}` | 200, sin cambios |
| 19 | Alta de usuario con contraseña de 73 caracteres o más | 400 |
| 20 | Login con JSON malformado | 400 (el login es público) |
| 21 | Login con el `username` en otras mayúsculas o con espacios en los extremos | 200 |
| 22 | Credencial inválida o vencida enviada a un endpoint público | se ignora → 200 |
| 23 | Dos altas simultáneas con el mismo `username` | una 201 y la otra 409 |
| 24 | Toda respuesta 401 | trae `WWW-Authenticate: Bearer` |
| 25 | La clave fija del TP-1 (`X-API-Key`) sin credencial | 401 |

## Fuera de alcance

- Refresh tokens y rotación de credenciales; cierre de sesión del lado del servidor.
- OAuth / login con terceros; recuperación de contraseña por email.
- Cambio o reseteo de contraseña, edición del propio perfil y borrado de usuarios.
- Registro de actividad (auditoría) del servicio original.
- Autoregistro: solo un admin da de alta usuarios.
- Límite de intentos de login (protección contra fuerza bruta).

## Criterios de finalización

- Cada RF y cada uno de los 25 casos límite tiene al menos un test automatizado que pasa.
- Los tests del TP-1 siguen pasando, adaptados de la clave fija a la credencial de admin
  (se modifican, no se borran).
- `pnpm lint`, `pnpm build`, `pnpm test` y `pnpm test:e2e` en verde.

## Decisiones de la entrevista (16/11)

1. **Lecturas del catálogo:** públicas, **declaradas explícitamente** como tales (se
   mantiene la HU-1 del TP-1 y la paridad con el original).
2. **Escrituras del catálogo:** solo rol `admin` (viewer → 403).
3. **Alta de usuarios:** solo un admin; el login es el único endpoint público de escritura.
4. **Administración:** el admin cambia rol y habilitación de **otros**; nadie cambia su
   propio rol ni se deshabilita a sí mismo.
5. Por defecto (avisado en la entrevista): el rol vive en el registro del usuario y cada
   operación declara el rol que pide; la credencial dura 30 minutos, configurable; los
   usuarios del login son una tabla propia, sin relación con clientes ni empleados; la
   clave fija del TP-1 se reemplaza.

Correcciones aprobadas tras clarify ronda 1 (A1–A4, K1, C1–C2, T1, R1): login sin
distinguir mayúsculas en el `username`; reenviar el valor propio → 200; mensajes 401
fijados y header `WWW-Authenticate`; `bearer` sin distinguir mayúsculas; login con JSON
malformado → 400; credencial ignorada en lo público; altas simultáneas → 201 + 409;
RNF-4 comprobable; HU-3 y HU-8 cubren RF-12 y RF-13.

Respuesta a las 5 preguntas de la consigna: (1) el rol se guarda en la base y se exige
por operación; (2) 30 minutos, configurable fuera del repo; (3) tabla de usuarios
propia; (4) el rol de otro sí, el propio no; (5) el alta la hace un admin.

## Dudas abiertas

- Ninguna.
