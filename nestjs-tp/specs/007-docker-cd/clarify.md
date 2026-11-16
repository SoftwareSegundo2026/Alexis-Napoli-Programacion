# Clarify 007 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 007-docker-cd`).
> Revisión contra `spec.md` (aprobada el 16/11), `docs/constitution.md`, las specs anteriores
> (en especial 001 RF-9, 002 RNF-2, 005 y 006), el código actual (`main.ts`, `app.setup.ts`,
> `env.validation.ts`, `database.module.ts`, `.github/workflows/ci.yml`) y
> `consignas/TP7-docker-cd-observabilidad.md`.

## Ronda 1 — 16/11

### Alcance y casos límite de la consigna

| Exigencia de la consigna | ¿Está en la spec? |
|---|---|
| Dockerfile multi-stage, sin toolchain, usuario no root, `.dockerignore` | Sí: RF-1, RF-2, casos 10 y 11 |
| Compose API + base, `healthcheck`, `depends_on` condicionado, no ready sin base | Parcial: RF-4 y caso 1 (ver K1) |
| Mismo artefacto en dev y prod, sin secretos en la imagen | Sí: RF-3, RNF-2 |
| CD: build → registry → SSH → reinicio, secretos en *repository secrets* | Sí: RF-8, RF-9 (ver A4, C2, T2) |
| Logs estructurados con nivel, mensaje, `requestId`, timestamp | Sí: RF-11–RF-14 (ver A3, C3) |
| `GET /health` con el estado real de la app y la conexión | Sí: RF-5 (ver A1, K2) |
| Observe opcional con credenciales | Sí: RF-15 |
| Los 4 gates también dentro del build de la imagen | Sí: RF-1 (ver A5) |
| Caso: compose con la base apagada → no ready | Sí: caso 1 (ver K1) |
| Caso: imagen construida dos veces → equivalente | Sí: caso 3 (ver A2) |
| Caso: log de error con `requestId` y sin datos sensibles | Sí: caso 4 |
| Caso: variables mal seteadas → falla al arrancar con mensaje claro | Sí: RF-6, caso 5 (ver K3) |
| Caso: el servidor se reinicia → el servicio vuelve solo | Sí: caso 6 (ver T1) |
| Criterio: rollback documentado; `docker history` limpio | Sí: RF-10, RNF-2 (ver T2) |

Detecciones adicionales:

### 1. Ambigüedades

- **A1.** RF-5 dice "puede consultar su base", pero no dice **qué consulta**. En SQLite,
  `SELECT 1` se evalúa sin leer el archivo: respondería `up` aunque la base esté dañada o
  inaccesible. Así `/health` no informaría el "estado real" que pide la consigna.
- **A2.** RNF-1 / caso 3 definen "equivalentes" como "mismos archivos con el mismo contenido",
  pero no dicen **cómo se compara** (¿digest de la imagen?, ¿hash del sistema de archivos?) ni qué
  pasa con las fechas de modificación, que cambian en cada build.
- **A3.** RF-12 fija nivel `error` para los 5xx, pero no dice qué nivel llevan los 2xx/3xx y los
  4xx. Sin eso, `LOG_LEVEL=warn` no tiene un significado claro (¿se ven los 404?).
- **A4.** RF-9 no dice qué tiene que existir **antes** en el servidor ni qué copia el despliegue:
  - Docker instalado.
  - El `docker-compose.yml`.
  - El `.env` con `JWT_SECRET`.
  - Con qué credencial baja la imagen de `ghcr.io`.
  - **Qué tag** usa el compose del servidor. Con `latest` fijo, el rollback de RF-10 a un sha no
    tiene dónde indicarse.
- **A5.** RNF-3 habla de "un job de Actions", pero no dice **cuándo corre** (¿en cada PR?, ¿solo
  en `main`?). Si corre en PRs, los gates se ejecutan dos veces: en `gates` y dentro del build
  de la imagen. Si corre solo en `main`, la evidencia llega después del merge.

### 2. Contradicciones

- **K1.** La consigna pide `depends_on` **condicionado**. Con un único servicio no hay de qué
  depender. La decisión 1 lo explica a medias, pero la spec no lo declara como **adaptación** de
  la consigna; un revisor lo leería como faltante.
- **K2.** La spec 001 (RF-9) fija que todo error de la API responde `{"detail": "..."}`. RF-5
  define el 503 de `/health` como `{"status":"error","database":"down"}`, sin `detail`.
  Además, documentar `/health` toca otros tests y no se menciona:
  - El inventario del contrato (TP-5) exige casos para toda operación documentada.
  - `protection.e2e` y `docs.e2e` fijan la cantidad de operaciones.
- **K3.** El caso 5 usa `LOG_LEVEL=verbose` como ejemplo **inválido**, pero `verbose` (y `fatal`)
  son niveles reales del logger de Nest. El ejemplo confunde, y RF-15 no explica por qué esos
  niveles se excluyen.

### 3. Casos límite no cubiertos

- **C1.** Apagado ordenado: al redesplegar o reiniciar, Docker manda `SIGTERM`. Node como
  proceso 1 del contenedor no lo atiende por defecto: Docker espera 10 s y lo mata (`SIGKILL`),
  cortando pedidos en curso, incluida una transacción de reserva a la mitad. No hay requisito ni
  caso.
- **C2.** Falla del despliegue: solo está "sin secrets → se saltea". No se define:
  - Qué pasa si el SSH falla (host caído, clave mala).
  - Cómo se sabe que el despliegue **funcionó**: ¿se verifica `/health` en el servidor después
    de `up -d`?
  - Qué pasa con dos pushes seguidos a `main`: un despliegue viejo podría terminar después del
    nuevo y dejar la versión anterior.
- **C3.** El `healthcheck` de compose consulta `/health` cada pocos segundos. Por RF-12, cada
  consulta deja una línea de log: miles por día de ruido, justo lo que impide responder "¿qué
  pasó a las 3 AM?". No se dice si `/health` se registra.

### 4. Conflictos con la constitution / reglas no comprobables

- **T1.** El caso 6 ("el servidor se reinicia") y el caso 1 se verifican "en un job de Actions",
  pero no se dice **cómo**. Tampoco cómo obtiene ese job un `JWT_SECRET` válido para levantar el
  compose sin versionarlo (constitución §5: secretos solo en `.env`, nunca en el repo).
- **T2.** Sin servidor, el job de despliegue siempre se saltea: RF-9 y RF-10 (despliegue y
  rollback) **nunca se ejecutan** y no tienen evidencia posible. "Rollback documentado" sería
  solo texto sin probar.

### 5. RF sin criterio de aceptación

- **R1.** RF-15 (`LOG_LEVEL` filtra por nivel) no tiene caso: el caso 5 solo prueba el valor
  inválido, no que un nivel menor deje de escribirse. RF-13 y RF-14 no aparecen en ninguna
  historia de usuario.

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A5, K1–K3, C1–C3, T1–T2, R1)

## Ronda 2 — 16/11

Revisión de la spec corregida (resoluciones aprobadas por el usuario).

| Detección | Dónde quedó resuelta | Estado |
|---|---|---|
| A1 | RF-5: `SELECT COUNT(*) FROM sqlite_master` (lee el archivo); caso 2 | Resuelta |
| A2 | RNF-1: listado de archivos con ruta, permisos y SHA-256; fechas fuera; caso 3 | Resuelta |
| A3 | RF-12: 2xx/3xx `log`, 4xx `warn`, 5xx `error` | Resuelta |
| A4 | RF-4 (`IMAGE_TAG`), RF-9 (`deploy.sh` copia el compose), RF-17 (preparación del servidor) | Resuelta |
| A5 | RF-8 y RNF-3: workflow de Docker en PR (sin publicar) y en `main`; duplicación aceptada | Resuelta |
| K1 | Sección "Adaptaciones a la consigna" | Resuelta |
| K2 | RF-5: 503 con `detail`; RNF-6: contrato y 35 operaciones | Resuelta |
| K3 | RF-15: los 6 niveles de Nest; caso 5 con `LOG_LEVEL=loud` | Resuelta |
| C1 | RF-16 y caso 16 | Resuelta |
| C2 | RF-9: espera `healthy`, rojo si falla, despliegues en fila; caso 17 | Resuelta |
| C3 | RF-12: `/health` 200 en `debug`, 503 en `error` | Resuelta |
| T1 | RNF-7 (`JWT_SECRET` generado en la corrida); casos 1 y 6 con método definido | Resuelta |
| T2 | RF-9/RF-10 con `deploy.sh`; caso 12 con el runner como servidor | Resuelta |
| R1 | Caso 15; HU-3 cubre RF-13 y RF-14 | Resuelta |

Verificaciones de la ronda 2:
- RF-5 ahora cumple la spec 001 RF-9 (`detail`).
- RF-6 y RF-15 extienden, sin contradecirla, la spec 002 RNF-2.
- RNF-4 mantiene intacto el check requerido de la spec 006.
- Cada exigencia y caso de la consigna tiene RF, caso o adaptación declarada.
- Ningún requisito depende de tener Docker local ni un servidor.
- Los secretos solo viven en `.env` o en *repository secrets*.

**VEREDICTO: APROBADA**
