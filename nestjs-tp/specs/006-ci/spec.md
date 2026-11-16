# Spec 006 — Integración continua con GitHub Actions (TP-6)

Estado: **aprobada** (16/11, Alexis Napoli; repo ya público) · Se apoya en `specs/005-calidad/` (gates y umbral de cobertura, aprobada y validada)

## Contexto y objetivo

Hoy los gates de la constitución (`lint · build · test · test:e2e`) y el de cobertura del
TP-5 se corren **a mano**: nada impide integrar a la rama principal código que no los
pase. Este cambio los convierte en **condiciones de merge automáticas**: cada cambio
propuesto se verifica solo en GitHub, y si algo falla el merge queda bloqueado.

Los requisitos son **de proceso**, no de código de la API: no cambia ningún endpoint.

## Usuarios

| Rol | Qué necesita |
|---|---|
| Desarrollador (yo, y los próximos TPs) | Saber antes de integrar si el cambio rompe algún gate, y cuál |
| Revisor / docente | Que sea imposible mergear algo en rojo, y poder comprobarlo por su cuenta |

## Historias de usuario

- **HU-1.** Como desarrollador, quiero que cada pull request corra todos los gates
  automáticamente, para no depender de acordarme de correrlos.
  *Aceptación:* abrir o actualizar un PR hacia `main` dispara el pipeline, también si solo
  cambia documentación; un push a `main` también lo dispara (RF-1, RF-2, RF-8).
- **HU-2.** Como desarrollador, quiero ver **qué** gate falló sin leer todo el log.
  *Aceptación:* cada gate es un paso con nombre propio (RF-3).
- **HU-3.** Como revisor, quiero que un PR con un gate en rojo no se pueda mergear,
  ni siquiera por un admin.
  *Aceptación:* PR rojo con "Merging is blocked", verificable por cualquiera (RF-5).
- **HU-4.** Como desarrollador, quiero que el pipeline sea rápido en corridas repetidas.
  *Aceptación:* la segunda corrida reutiliza la cache de dependencias (RF-6).
- **HU-5.** Como responsable de seguridad, quiero que el pipeline no tenga más permisos
  de los necesarios ni exponga secretos.
  *Aceptación:* `permissions:` explícito de solo lectura; ninguna credencial en el repo (RNF-1, RNF-2).

## Requisitos (en EARS)

- **RF-1:** CUANDO se abre, se reabre o se actualiza un pull request hacia `main`, EL
  SISTEMA ejecuta el pipeline de CI.
- **RF-2:** CUANDO se hace push a `main`, EL SISTEMA ejecuta el mismo pipeline.
- **RF-3:** EL pipeline ejecuta, en un job llamado **`gates`**, como **pasos separados y con
  nombre propio**, en este orden: instalación de dependencias (con el lockfile tal cual, sin
  modificarlo), `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm test:cov` y
  `pnpm typecheck`. SI un paso falla, ENTONCES el job termina en rojo, los pasos siguientes
  no corren y el paso que falló queda señalado.
- **RF-4:** Los gates usan **los mismos comandos** que la constitución y el TP-5: todos son
  scripts de `package.json` (se agrega `typecheck` = `tsc --noEmit -p tsconfig.json`, el
  chequeo de tipos que ya se corría a mano en cada tarea), dentro de `nestjs-tp/`; no hay
  comandos alternativos solo para CI.
- **RF-5:** SI el job `gates` no termina en verde, ENTONCES el pull request **no se puede
  mergear** a `main`: la rama tiene `gates` como *required status check* y la regla no
  admite excepciones, tampoco para administradores. El nombre del job es fijo: renombrarlo
  obliga a actualizar la regla (si no, todo PR queda "Expected — waiting").
- **RF-6:** CUANDO el pipeline instala dependencias, EL SISTEMA reutiliza la cache de pnpm
  si el lockfile no cambió.
- **RF-7:** CUANDO el paso de cobertura llegó a correr (en verde o en rojo), EL SISTEMA
  publica el reporte como artefacto descargable de la corrida. SI el pipeline falló antes,
  ENTONCES no hay artefacto, y eso no es un error adicional.
- **RF-8:** EL pipeline corre en todo PR hacia `main`, aunque solo cambie documentación
  (sin filtro por rutas: un check requerido que no corre deja el PR trabado).
- **RF-9:** Desde que `main` queda protegida, el trabajo de cada TP se integra por **pull
  request**: se commitea en una rama propia (p. ej. `tp-3-busqueda`), se pushea la rama y el
  usuario mergea el PR cuando `gates` está en verde. Excepción única: el commit que agrega
  `ci.yml` va a `main` **antes** de activar la regla, para que el check corra una vez y
  aparezca en la lista de *required status checks*.

## Requisitos no funcionales

- **RNF-1:** El workflow declara `permissions:` explícito, con solo lectura del contenido
  del repositorio.
- **RNF-2:** Ningún archivo del repo ni del workflow contiene tokens, contraseñas ni un
  `.env` real. Los tests usan los valores de prueba que ya existen (`test/helpers/test-env.ts`,
  no reales). Hoy el pipeline **no necesita secretos**; si alguno hiciera falta, iría en
  *repository secrets* con nombre claro, y los PR desde forks no lo recibirían. Se
  verifica con una búsqueda de patrones (`token`, `password`, `secret`, `BEGIN … KEY`,
  archivos `.env`) en el repo y en el historial, documentada en `validate.md`.
- **RNF-3:** El YAML está comentado en español: cada job y cada step explica qué valida.
- **RNF-4:** El workflow vive en `.github/workflows/ci.yml` en la **raíz** del repo (GitHub
  solo lee esa carpeta) y trabaja dentro de `nestjs-tp/`.
- **RNF-5:** La suite sigue en verde localmente con los 5 gates.
- **RNF-6:** El job tiene un tiempo máximo de 15 minutos; un push nuevo a la misma rama
  cancela la corrida anterior que siga en curso.
- **RNF-7:** CI usa la misma versión de pnpm que la máquina local, declarada en
  `package.json` (`"packageManager": "pnpm@12.6.0"`), y Node 24.

## Casos límite

| # | Situación | Esperado / evidencia |
|---|---|---|
| 1 | PR con un test en rojo | Check rojo en el paso `test`; "Merging is blocked" (captura) |
| 2 | PR que solo toca documentación | El pipeline corre igual |
| 3 | Segunda corrida sin cambios en el lockfile | Log con la cache restaurada |
| 4 | Lint con un error | Falla el paso `lint`; build y tests no corren |
| 5 | Cobertura bajo el umbral con tests verdes | Falla el paso `test:cov`; el reporte igual se publica |
| 6 | Lockfile desactualizado respecto de `package.json` | Falla la instalación (no se modifica el lockfile en CI) |
| 7 | PR desde un fork | No recibe secretos: el workflow usa `pull_request` (no `pull_request_target`); se verifica leyendo el YAML |
| 8 | Admin intenta mergear un PR rojo | Bloqueado: la regla no admite excepciones |
| 9 | El workflow intenta escribir en el repo | No puede: el log de cada corrida muestra los permisos del token ("Contents: read") |
| 10 | Un test se cuelga | El job se corta a los 15 minutos |
| 11 | Dos pushes seguidos a la misma rama | Se cancela la corrida anterior |

## Fuera de alcance

- Deploy (TP-7); matriz de varias versiones de Node; análisis estático de pago.
- CI para las otras carpetas del repo (`TP-fastAPI/`, `fut-api/`, etc.).

## Criterios de finalización

- `ci.yml` corrió en GitHub al menos una vez en verde sobre `main`.
- Regla de protección en `main` con el check requerido y sin excepciones.
- PR deliberadamente rojo que no se pudo mergear: link y captura en `nestjs-tp/README.md`
  y en `specs/006-ci/validate.md`.
- Ningún secreto en el repo; 5 gates en verde localmente.

## Decisiones de la entrevista (16/11)

1. **Protección de rama:** se hace **público** el repo del TP (opción 2 de la consigna:
   en GitHub Free la protección funciona en repos públicos). Lo hace el usuario en GitHub.
   Antes de hacerlo conviene confirmar con el docente: también quedan visibles las otras
   carpetas del repo. El historial ya fue revisado sin secretos (validación del TP-2).
2. **Pasos además de los 4 gates:** `pnpm test:cov` (el umbral del TP-5 se hace cumplir en
   CI; su reporte es el artefacto que pide la consigna) y `tsc --noEmit` (tipos de `test/`).
3. Por defecto (avisado en la entrevista): Node 24 y pnpm 12 (los locales); cache de pnpm;
   `permissions` de solo lectura; sin filtro `paths:`; el PR rojo de evidencia rompe un
   test a propósito y se cierra sin mergear.

Correcciones aprobadas tras clarify ronda 1 (A1–A3, K1–K2, C1–C3, T1–T2, R1): job `gates`
con nombre fijo; artefacto solo si la cobertura corrió; evidencia en `nestjs-tp/README.md`;
script `typecheck`; **una rama por TP + PR** desde que `main` quede protegida (RF-9); tiempo
máximo 15 min y cancelación de corridas viejas; pnpm fijado en `packageManager`; casos 7 y 9
verificables (YAML y log); búsqueda de secretos documentada; HU-1 cubre RF-2 y RF-8.

## Reparto del trabajo

| Quién | Qué |
|---|---|
| Claude | Spec, plan, `ci.yml`, documentación, ramas y commits; push solo con OK |
| Usuario (en GitHub) | Hacer público el repo (hecho), configurar la regla de `main`, abrir y mergear PRs, abrir el PR rojo y sacar la captura |

(No hay CLI `gh` en esta máquina: lo que se hace en la web de GitHub lo hace el usuario.)

## Dudas abiertas

- Ninguna (pendiente de clarify).
