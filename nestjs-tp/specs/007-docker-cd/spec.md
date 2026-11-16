# Spec 007 — Docker, despliegue continuo y observabilidad (TP-7)

Estado: **aprobada** (16/11, Alexis Napoli) · Se apoya en las specs 001–006 (aprobadas y validadas); en especial la 006 (CI)

## Contexto y objetivo

La API corre "en mi máquina": hay que instalar Node y pnpm, copiar un `.env` y arrancarla a mano.
Si algo falla en producción, los logs son texto suelto sin forma de seguir un pedido. Este cambio
la lleva a **"se despliega sola y se puede observar"**: una **imagen Docker reproducible** que
corre igual en cualquier máquina cambiando solo el `.env`, un **pipeline de CD** que construye,
publica y despliega en cada push a `main`, y **logs estructurados** con un identificador por
pedido, más un `GET /health` que dice la verdad sobre la app y su base.

La base es **SQLite** (un archivo, no un servidor). Por eso el `compose` tiene un solo servicio
(`api`) con la base en un **volumen** persistente, y "la base no responde" significa que el
archivo no se puede leer como base o la conexión está cerrada (decisión 1; ver "Adaptaciones").

## Usuarios

| Rol | Qué hace |
|---|---|
| Operador | Prepara el servidor una vez, despliega, vuelve a una versión anterior, lee los logs |
| Desarrollador | Hace merge a `main` y el despliegue ocurre solo |
| Orquestador (Docker/compose) | Consulta `GET /health` para saber si la app está lista |

## Historias de usuario

- **HU-1.** Como operador, quiero levantar la API en una máquina limpia con un solo comando,
  para no depender de lo que tenga instalado. *Aceptación:* con Docker y un `.env`,
  `docker compose up -d` deja la API respondiendo y `healthy` (RF-1, RF-4, RF-5).
- **HU-2.** Como desarrollador, quiero que cada merge a `main` se publique y despliegue solo.
  *Aceptación:* push a `main` → imagen publicada con el sha del commit → despliegue verificado
  con `/health` (RF-8, RF-9).
- **HU-3.** Como operador, quiero responder "¿qué pasó a las 3 AM?" con los logs. *Aceptación:*
  cada pedido deja una línea JSON con hora, nivel, `requestId`, método, ruta, estado y duración;
  un error deja su detalle con el mismo `requestId`, que también viaja en la respuesta
  (`X-Request-Id`), y ninguna línea tiene contraseñas ni credenciales (RF-11–RF-14).
- **HU-4.** Como operador, quiero volver a la versión anterior si un despliegue sale mal.
  *Aceptación:* el rollback a un sha anterior está documentado, se hace sin reconstruir y está
  probado (RF-10).

## Requisitos funcionales (en EARS)

**Imagen y compose**

- **RF-1:** EL SISTEMA se construye con un `Dockerfile` **multi-stage**: una etapa de build
  (instala dependencias, compila y **corre los 4 gates**: lint, build, test, test:e2e) y una etapa
  final de runtime que solo tiene Node, las dependencias de producción, `dist/` y la base plantilla.
  SI un gate falla, ENTONCES la imagen no se construye.
- **RF-2:** La imagen final corre con un **usuario no root**, sin herramientas de build (sin
  pnpm, TypeScript ni compiladores) y sin ningún archivo `.env` ni secreto; el `.dockerignore`
  excluye `node_modules`, `.env*` (salvo `.env.example`), `dist`, `coverage` y la base de trabajo.
- **RF-3:** EL SISTEMA usa la **misma imagen** en cualquier entorno: todo lo que cambia entre
  entornos (secreto, puerto, nivel de log, ruta de la base) entra por variables de entorno.
- **RF-4:** El `docker-compose.yml` define el servicio `api` con la imagen
  `ghcr.io/<repo>:${IMAGE_TAG:-latest}`, la base en un volumen persistente, `env_file: .env`, un
  `healthcheck` que consulta `GET /health` y `restart: always`. CUANDO `GET /health` no responde
  200, el contenedor queda `unhealthy` (no "ready").

**Salud, arranque y apagado**

- **RF-5:** `GET /health` es público, está fuera del prefijo `/api/v1` y está documentado
  (contrato del TP-5). Hace una consulta que **lee el archivo de la base**
  (`SELECT COUNT(*) FROM sqlite_master`; `SELECT 1` no alcanza porque no toca el archivo). SI la
  consulta funciona, ENTONCES responde 200 `{"status":"ok","database":"up"}`; SI falla (conexión
  cerrada, archivo que no es una base), ENTONCES responde 503
  `{"status":"error","database":"down","detail":"Database unavailable"}`, sin exponer el error
  interno (cumple el formato `{detail}` de la spec 001 RF-9).
- **RF-6:** SI una variable de entorno falta o es inválida (incluida la nueva `LOG_LEVEL`),
  ENTONCES EL SISTEMA no arranca y el log dice **qué variable** y **qué se esperaba**, antes de
  atender el primer pedido (extiende la spec 002 RNF-2).
- **RF-7:** SI la base de trabajo no se puede abrir al arrancar, ENTONCES EL SISTEMA termina con un
  error claro (no queda escuchando a medias) y el contenedor nunca llega a `healthy`.
- **RF-16:** CUANDO el proceso recibe `SIGTERM` (redespliegue, `docker compose stop`, reinicio),
  EL SISTEMA deja de aceptar conexiones nuevas, termina los pedidos en curso, cierra la base,
  registra el apagado y sale con código 0 dentro del período de gracia del contenedor.

**Despliegue continuo**

- **RF-8:** CUANDO hay un push a `main`, EL SISTEMA construye la imagen (con los gates adentro) y
  la publica en GitHub Container Registry (`ghcr.io`) con dos tags: el sha del commit y `latest`.
  La autenticación usa el token de la corrida; no hay credenciales del registry en el repo. En un
  PR, la imagen se construye y se prueba, pero **no** se publica ni se despliega.
- **RF-9:** CUANDO la imagen se publicó, EL SISTEMA despliega por SSH ejecutando en el servidor un
  **script versionado** (`deploy.sh <sha>`): copia el `docker-compose.yml`, baja la imagen de ese
  sha, la levanta con `IMAGE_TAG=<sha> docker compose up -d` y **espera a que quede `healthy`**
  (hasta 60 s). Los datos del servidor (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`) van en
  *repository secrets*. SI esos secrets no están configurados, ENTONCES el despliegue se saltea con
  un aviso visible y la corrida no falla. SI el SSH falla o el servicio no queda `healthy`,
  ENTONCES la corrida falla (rojo). Los despliegues van **en fila** (uno por vez) y prevalece el
  último push.
- **RF-10:** El **rollback** es ejecutar el mismo despliegue con el sha de una imagen ya
  publicada: EL SISTEMA permite lanzarlo a mano (`workflow_dispatch` con el sha), sin
  reconstruir. El procedimiento está en el README.
- **RF-17:** El servidor se prepara **una sola vez** a mano (README): Docker con el plugin
  compose, una carpeta de despliegue con el `.env` de producción (nunca sale del repo) y el
  usuario SSH con permiso para usar Docker. Como el repo es público, la imagen se baja sin
  credencial; si el paquete fuera privado, el README indica el `docker login ghcr.io` con un token
  de solo lectura.

**Observabilidad**

- **RF-11:** EL SISTEMA escribe sus logs como **una línea JSON por evento** en la salida estándar,
  con al menos `timestamp` (ISO 8601 UTC), `level`, `message` y, si el evento ocurre durante un
  pedido, `requestId`. No queda ningún `console.log` suelto en `src/`.
- **RF-12:** CUANDO termina un pedido HTTP, EL SISTEMA registra una línea con `requestId`,
  método, ruta **sin query string**, código de estado y duración en ms, con nivel según el
  resultado: 2xx/3xx → `log`, 4xx → `warn`, 5xx → `error`. Los errores 5xx registran además el
  detalle técnico con el mismo `requestId`. Excepción: `GET /health` con 200 se registra en nivel
  `debug` (el healthcheck no llena los logs); con 503, en `error`.
- **RF-13:** CUANDO llega un pedido, EL SISTEMA le asigna un `requestId`: usa el header
  `X-Request-Id` si viene y es seguro (1–64 caracteres de `[A-Za-z0-9._-]`); si no, genera uno
  nuevo (UUID). Lo devuelve en el header `X-Request-Id` de la respuesta.
- **RF-14:** Ningún log contiene datos sensibles: nunca se registran cuerpos, headers ni query
  strings, y todo texto que se registra pasa por un filtro que tapa credenciales `Bearer`/JWT y
  valores de campos sensibles (`password`, `token`, `secret`, `authorization`, `dni`).
- **RF-15:** `LOG_LEVEL` acepta los niveles de Nest, de más a menos grave: `fatal`, `error`,
  `warn`, `log`, `debug`, `verbose` (por defecto `log`), y se escriben ese nivel y los más
  graves. La telemetría de NestJS Observe sigue siendo opcional (solo con credenciales en el
  entorno), como hoy.

## Requisitos no funcionales

- **RNF-1:** **Reproducible:** dos builds del mismo commit producen imágenes **equivalentes**:
  el listado de todos los archivos de la imagen con su ruta, permisos y hash SHA-256 del contenido
  es idéntico (las fechas de modificación no cuentan). Que el digest de la imagen coincida se
  informa, pero no es condición. Imagen base fijada por versión y digest; dependencias con el
  lockfile congelado.
- **RNF-2:** **Sin secretos** en la imagen (`docker history` y sistema de archivos limpios) ni en
  el historial de git (ningún `.env` versionado).
- **RNF-3:** Como no hay Docker en la máquina local, la evidencia se produce **automáticamente en
  GitHub Actions**: un workflow aparte del de CI construye la imagen, la levanta con compose y
  prueba los casos límite, en cada PR y en cada push a `main`. Los gates corren otra vez dentro
  del build (lo exige la consigna); se acepta esa duplicación.
- **RNF-4:** El workflow de CI existente (`gates`, único check requerido de `main`) no cambia su
  nombre ni su comportamiento.
- **RNF-5:** Permisos mínimos: el token de la corrida solo tiene `packages: write` en el job que
  publica; publicar y desplegar no corren en PRs.
- **RNF-6:** Gates locales en verde, cobertura ≥ 75/75, contrato del TP-5 con `GET /health`
  (`protection.e2e` y `docs.e2e` pasan a 35 operaciones); el trabajo entra por la rama
  `tp-7-docker-cd` y un PR.
- **RNF-7:** Para las pruebas en Actions, el `JWT_SECRET` se **genera al azar en la corrida** y
  se escribe en un `.env` temporal del runner; nunca se versiona (constitución §5).

## Casos límite

| # | Situación | Esperado | Evidencia |
|---|---|---|---|
| 1 | Compose con un archivo de base que no es una base | La app termina con error claro; el contenedor nunca queda `healthy` | Workflow de Docker |
| 2 | La conexión a la base se cierra con la app andando | `GET /health` → 503 `database: down` con `detail` | Test e2e |
| 3 | Imagen construida dos veces | Listados de archivos con hash idénticos | Workflow de Docker |
| 4 | Error 500 en un pedido con `Authorization` y `password` en el cuerpo | Log de error con `requestId`, sin token ni contraseña | Test |
| 5 | `JWT_SECRET` corto o `LOG_LEVEL=loud` | No arranca; el mensaje nombra la variable | Test + workflow de Docker |
| 6 | El servidor se reinicia (se reinicia el daemon de Docker del runner) | El servicio vuelve solo y queda `healthy` | Workflow de Docker |
| 7 | `X-Request-Id` válido en el pedido | Se respeta y vuelve en la respuesta | Test e2e |
| 8 | `X-Request-Id` con saltos de línea, comillas o de 65+ caracteres | Se ignora y se genera uno nuevo | Test e2e |
| 9 | Push a `main` sin secrets de despliegue | Imagen publicada; despliegue salteado con aviso; corrida verde | Corrida de Actions |
| 10 | Usuario del contenedor | No es root (uid ≠ 0); no hay pnpm ni tsc | Workflow de Docker |
| 11 | `.env` en el contexto del build | No entra a la imagen | Workflow de Docker |
| 12 | Despliegue y rollback | `deploy.sh` con un sha → `healthy` con esa imagen; `deploy.sh` con otro sha → `healthy` con la otra | Workflow de Docker (el runner hace de servidor) |
| 13 | `GET /health` sin credencial | 200 (es público) | Test e2e |
| 14 | Pedido con query string (`?q=...`) | La línea de log tiene la ruta sin la query | Test |
| 15 | `LOG_LEVEL=warn` | Un pedido con 200 no deja línea; uno con 404 sí | Test |
| 16 | `docker compose stop` | La app registra el apagado y sale con código 0 | Workflow de Docker |
| 17 | El servicio no queda `healthy` tras desplegar | `deploy.sh` falla (código ≠ 0) y muestra los logs del contenedor | Workflow de Docker |

## Adaptaciones a la consigna

- **"API + base de datos" y `depends_on` condicionado:** la consigna supone una base servidor.
  SQLite está embebida en la app, así que no hay un segundo servicio del cual depender. La
  garantía que busca la consigna, que la app no quede "ready" sin base, la dan `GET /health`
  con una consulta real al archivo (RF-5), el arranque que falla si no puede abrir la base (RF-7)
  y el `healthcheck` del compose (RF-4).
- **"Despliegue en el servidor":** no hay servidor. El job por SSH queda listo y se activa con
  los secrets; el **mismo** `deploy.sh` se prueba en Actions con el runner como servidor (caso 12).

## Fuera de alcance

- Kubernetes; varios entornos con infraestructura como código; alertas.
- Migrar a una base servidor (PostgreSQL): se mantiene SQLite (decisión 1).
- Un servidor real (decisión 2).

## Criterios de finalización

- Cada RF y caso límite con test automatizado o evidencia en una corrida de Actions.
- README con: levantar en una máquina limpia, variables, preparar el servidor, despliegue,
  rollback y cómo leer los logs.
- Gates locales y `gates` del PR en verde; workflow de Docker en verde; PR mergeado por el usuario.

## Decisiones de la entrevista (16/11)

1. **Base:** SQLite en un volumen; un servicio `api`; "base apagada" = archivo inaccesible o
   conexión cerrada → `/health` 503 / no arranca. Migrar a PostgreSQL no entra en el plazo.
2. **Servidor:** no hay; el deploy por SSH corre solo si existen los secrets
   `DEPLOY_HOST`, `DEPLOY_USER` y `DEPLOY_SSH_KEY`; si no, se saltea con aviso.
3. **Registry:** GitHub Container Registry, con el token de la corrida.
4. **Logs:** logger propio (sin dependencias nuevas): `LoggerService` JSON + `requestId` por
   pedido con `AsyncLocalStorage`.

Correcciones aprobadas tras clarify ronda 1 (A1–A5, K1–K3, C1–C3, T1–T2, R1): `/health` lee el
archivo y su 503 trae `detail`; equivalencia por listado de archivos con hash; nivel de log por
código de estado y `/health` en `debug`; preparación del servidor (RF-17) e `IMAGE_TAG`; workflow
de Docker en PR y `main`; sección de adaptaciones; niveles reales de Nest en `LOG_LEVEL`; apagado
ordenado (RF-16); despliegue verificado con `/health`, en fila y rojo si falla; `JWT_SECRET`
generado en la corrida (RNF-7); `deploy.sh` probado en Actions con el runner como servidor;
casos 15–17.

## Dudas abiertas

- Ninguna.
