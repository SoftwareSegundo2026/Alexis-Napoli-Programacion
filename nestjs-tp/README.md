# nestjs-tp — Starter de Spec-Driven Development para los TPs de NestJS

Material de la asignatura **Programación** para desarrollar los Trabajos Prácticos de
backend con NestJS siguiendo la metodología **SDD + multiagentes** de
`/home/dcazabat/Documentos/Cursos/DevelopAI/` (guías `GUIA-OPENCODE.md` y `GUIA-HERMES.md`).

> **Regla de oro:** la IA ejecuta, pero el responsable del proyecto sos vos.
> La spec manda: nada se implementa si no está en la spec aprobada.

---

## Puesta en marcha de la API (TP-1 catálogo Chinook + TP-2 autenticación y roles)

API REST con artistas, álbumes, géneros y pistas, con el mismo contrato que el
servicio FastAPI original (`specs/001-chinook-nest/`), protegida con login y roles
`admin` / `viewer` (`specs/002-auth-roles/`).

**Requisitos:** Node 24 y pnpm. `better-sqlite3` se compila al instalar
(habilitado en `pnpm-workspace.yaml`).

```bash
pnpm install
cp .env.example .env      # completar JWT_SECRET (obligatorio, ≥ 32 caracteres: sin él no arranca)
pnpm start:dev            # o: pnpm build && pnpm start:prod
```

| Qué | Dónde |
|---|---|
| Catálogo | `http://localhost:<PORT>/api/v1/{artists,albums,genres,tracks}` — lecturas públicas |
| Login | `POST /api/v1/auth/token` con `{"username","password"}` → `{"access_token","token_type":"bearer"}` |
| Credencial | header `Authorization: Bearer <access_token>`; vence en `JWT_EXPIRES_MINUTES` (30) |
| Escrituras del catálogo | solo rol `admin` (sin credencial → 401; viewer → 403) |
| Usuarios | `GET /api/v1/users/me` (cualquiera logueado); `GET`, `POST /api/v1/users` y `PATCH /api/v1/users/{id}` (admin) |
| Documentación interactiva | `http://localhost:<PORT>/docs` (botón *Authorize* para la credencial; JSON en `/docs-json`) |
| Listados | `?skip=0&limit=100` (máximo 100) |
| Errores | siempre `{"detail": "<mensaje>"}`; todo 401 trae `WWW-Authenticate: Bearer` |

**Usuarios:** la base trae los de la cátedra (con `IsAdmin` → rol admin). Un admin da de
alta usuarios nuevos con `POST /api/v1/users`; las contraseñas se guardan solo como hash.

**Base de datos:** `data/chinook.template.db` es la copia versionada de Chinook y
nunca se escribe. Al arrancar, si no existe la base de trabajo (`DATABASE_PATH`,
por defecto `data/chinook.db`, fuera del repo), se crea copiándola. Para volver a
los datos originales alcanza con borrar `data/chinook.db`.

**Tests:** `pnpm lint && pnpm build && pnpm test && pnpm test:e2e`. Los e2e
trabajan cada uno sobre una copia temporal de la base (`test/setup-e2e.ts`), así
que no tocan los datos de desarrollo.

## Integración continua (TP-6)

El workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (en la raíz del
repo) corre el job **`gates`** en cada pull request hacia `main` y en cada push a
`main`, también si el cambio es solo de documentación. Sus pasos, en orden y por
separado, son los mismos comandos que se corren a mano:

| Paso | Comando | Qué valida |
|---|---|---|
| Instalar dependencias | `pnpm install --frozen-lockfile` | Que el lockfile coincida con `package.json` (no lo modifica) |
| Lint | `pnpm lint` | Estilo y reglas del código (sin `any`, sin `@ts-ignore`) |
| Build | `pnpm build` | Que la aplicación compile |
| Unit tests | `pnpm test` | Tests unitarios |
| E2E tests | `pnpm test:e2e` | La API completa, incluido el contrato de todas las operaciones |
| Cobertura | `pnpm test:cov` | Líneas y ramas ≥ 75% sobre todo `src/` (spec 005) |
| Typecheck | `pnpm typecheck` | Tipos de `src/` y `test/` |

**Cómo leer un fallo:** en el PR, "Details" al lado de `gates` muestra la lista de
pasos; el que falló está en rojo y los siguientes no corren. Si llegó a correr la
cobertura, su reporte queda como artefacto `cobertura` de la corrida.

**La rama `main` está protegida:** exige el check `gates` en verde, exige pull request
y no admite excepciones, tampoco para administradores. Todo cambio entra por una rama
y un PR. El workflow tiene permisos de solo lectura, usa el evento `pull_request` (un
PR desde un fork corre sin secretos) y no necesita ningún secreto: los tests usan
valores de prueba propios.

**Evidencia del bloqueo:** el [PR #1](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/pull/1)
agrega un test que falla a propósito. Su
[corrida](https://github.com/SoftwareSegundo2026/Alexis-Napoli-Programacion/actions/runs/43891474309)
falla en "Unit tests", los pasos siguientes no corren y el merge queda deshabilitado
aun siendo administrador. Se cerró sin mergear.

![PR #1: el check requerido gates falló y el botón de merge está deshabilitado](docs/evidencias/006-pr-rojo-merge-bloqueado.png)

![Pasos del job gates: Unit tests en rojo; E2E, cobertura y typecheck sin correr](docs/evidencias/006-pr-rojo-pasos.png)

Configuración de la regla:
[PR obligatorio](docs/evidencias/006-regla-1-pull-request.png) ·
[check `gates` requerido](docs/evidencias/006-regla-2-check-gates.png) ·
[sin excepciones](docs/evidencias/006-regla-3-sin-bypass.png) ·
[permisos del token](docs/evidencias/006-permisos-token.png).
Detalle completo en [`specs/006-ci/validate.md`](specs/006-ci/validate.md).

---

## Cómo arrancar

Este repo es un **arnés**, no una app. Se superpone sobre un proyecto NestJS:

```bash
# 1. Base de código (o crear desde cero con `nest new`)
cp -r ../nestjs-music ~/mi-tp

# 2. Copiar el arnés SDD encima
cp -r nestjs-tp/. ~/mi-tp/          # AGENTS.md, MEMORY.md, docs/, .opencode/, .agents/

# 3. Abrir OpenCode dentro del proyecto
cd ~/mi-tp && opencode
```

Verificación mínima de que el arnés quedó bien: `/skills` muestra `sdd` y
`nestjs-esm`, `/agents` muestra `coordinator`, `planner`, `implementer` y
`reviewer`, y `pnpm test` corre.

---

## Qué hay en esta carpeta

| Ruta | Qué es | Quién lo usa |
|---|---|---|
| `AGENTS.md` | Instrucciones del proyecto (stack, comandos, límites). Máx. 40 líneas. | Agente (siempre) |
| `MEMORY.md` | Memoria entre sesiones: estado, decisiones, próximos pasos. | Agente, tras cada tarea |
| `docs/constitution.md` | 6 principios innegociables. Toda spec/plan/tarea debe cumplirlos. | Planner y reviewer |
| `.opencode/agents/` | Los 4 agentes: `coordinator`, `planner`, `implementer`, `reviewer`. | Coordinación |
| `.opencode/commands/` | Comandos `/sdd-*` que automatizan el flujo. | Alumno / docente |
| `.agents/skills/` | Skills `sdd` (el flujo) y `nestjs-esm` (trampas del stack). | Agente, al cargarlas |
| `specs/000-ejemplo-chinook/` | Spec, plan y tareas **de referencia** ya resueltos. | Modelo a imitar |
| `consignas/` | Consignas TP-1 a TP-8 + índice con recorrido sugerido. | Alumno |
| `rubrica/` | Rúbrica de entrega + comando de validación para el docente. | Docente |

---

## El flujo, en una línea

```
/sdd-constitution → /sdd-spec → /sdd-clarify → /sdd-plan → /sdd-tasks
                                                            ↓
              /sdd-validate ← /sdd-implement T1, T2, T3… (una tarea por vez)
```

**Nunca** se pasa a la fase siguiente sin la aprobación explícita del usuario.
Cada fase deja un artefacto en disco (`specs/NNN-*`), que es lo que se evalúa.

---

## Adaptaciones a NestJS (importante)

La guía DevelopAI de referencia está pensada en JS puro con `node --test`. En este
TP se reemplaza el gate por el del repo:

| En la guía | Acá |
|---|---|
| `node --test` | `pnpm test` (unit) + `pnpm test:e2e` (e2e con supertest) |
| Sin linter | `pnpm lint` (oxlint type-aware) + `pnpm format` (prettier) |
| Sin build | `pnpm build` debe pasar antes de cerrar una tarea |

Todo eso ya está reflejado en `AGENTS.md`, `docs/constitution.md`, la skill `sdd`
y los comandos `/sdd-implement` y `/sdd-validate`.

---

## Entregables por TP

1. `specs/NNN-<nombre>/spec.md` — QUÉ y POR QUÉ (HU + requisitos en EARS), aprobada.
2. `specs/NNN-<nombre>/plan.md` — CÓMO (archivos, capas, estrategia de tests).
3. `specs/NNN-<nombre>/tasks.md` — tareas de 20-30 min con **"Hecho cuando:"**.
4. Historial git: **un commit por tarea** marcada en `tasks.md`.
5. `MEMORY.md` actualizado al cierre de cada tarea.
6. Suite en verde: `pnpm lint && pnpm build && pnpm test && pnpm test:e2e` (y, desde el
   TP-5/TP-6, `pnpm test:cov` y `pnpm typecheck`; en GitHub los corre el job `gates`).

Ver detalles y pesos en [`rubrica/rubrica-entrega.md`](rubrica/rubrica-entrega.md).
