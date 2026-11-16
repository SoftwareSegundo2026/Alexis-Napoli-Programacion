# Clarify 006 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 006-ci`).
> Revisión contra `spec.md` (aprobada el 16/11), `docs/constitution.md`, `AGENTS.md` y
> `consignas/TP6-ci-github-actions.md`.

## Ronda 1 — 16/11

### Alcance obligatorio de la consigna

| Exigencia | ¿Está en la spec? |
|---|---|
| Spec de proceso en EARS ("CUANDO se abre un PR… SI falla, el merge queda bloqueado") | Sí: RF-1, RF-5 |
| `on: pull_request` y `on: push` a la rama principal | Sí: RF-1, RF-2 |
| Instalación con cache de pnpm | Sí: RF-6 |
| Los 4 gates como pasos separados | Sí: RF-3 |
| Reporter de cobertura o artefacto de log | Sí: RF-7 |
| Rama principal protegida con *required status checks* | Sí: RF-5 |
| Secretos en *repository secrets*, ninguno en el repo | Sí: RNF-2 |
| Evidencia del PR rojo bloqueado | Sí: criterios de finalización |
| YAML comentado en español | Sí: RNF-3 |
| Casos de la consigna (test rojo, solo docs, cache, `permissions`, fork) | Sí: casos 1, 2, 3, 9, 7 |

Detecciones adicionales:

### 1. Ambigüedades

- **A1.** RF-5 depende del **nombre del check**, que en GitHub es el `name:` del job, pero la
  spec no lo fija. Si después se renombra el job, la regla queda esperando un check que ya no
  existe ("Expected — waiting") y todo PR se traba sin aviso.
- **A2.** RF-7 publica el reporte "cuando termina el paso de cobertura", pero no dice qué pasa
  si el pipeline falla **antes** (p. ej. en `lint`): ¿se publica un artefacto vacío, se omite
  o falla la publicación?
- **A3.** Los criterios de finalización piden la evidencia "en el README", pero hay dos:
  el de la raíz y `nestjs-tp/README.md`.

### 2. Contradicciones

- **K1.** RF-4 dice que los gates son "los scripts de `package.json`", pero RF-3 incluye
  `pnpm exec tsc --noEmit -p tsconfig.json`, que **no** es un script de `package.json`.
- **K2.** **Choque con la forma de trabajar del proyecto.** Hasta hoy todos los commits van
  directo a `main` y se pushean (solo existe la rama `main`). Con RF-5 y la rama protegida,
  GitHub rechaza un push directo a `main` cuyos commits no pasaron el check requerido. La
  spec no dice cómo se integra el trabajo de los próximos TPs (TP-3, TP-4, TP-7) ni si la
  regla exige pull request para todo cambio.

### 3. Casos límite no cubiertos

- **C1.** No hay **tiempo máximo** para el job: si un test se cuelga, la corrida consume
  horas antes de fallar.
- **C2.** Dos pushes seguidos a la misma rama: no se define si la corrida anterior sigue o
  se cancela (gasto de minutos y checks viejos en el PR).
- **C3.** No se fija cómo se elige la versión de pnpm en CI: `package.json` no la declara
  (`packageManager`), y una versión distinta de la local puede regenerar el lockfile o
  fallar la instalación (caso 6) por un motivo ajeno al cambio.

### 4. Conflictos con la constitution / reglas no comprobables

- **T1.** Los casos 7 (fork) y 9 (el workflow intenta escribir) no tienen forma de
  verificación: no hay fork para probar ni un paso que intente escribir. Tal como están,
  no se pueden comprobar.
- **T2.** RNF-2 ("ningún archivo contiene tokens…") no dice cómo se verifica.
- `AGENTS.md` pide preguntar antes de cambiar la estructura de carpetas: `.github/` en la
  raíz es una carpeta nueva. La spec la declara (RNF-4) y fue aprobada; sin conflicto.

### 5. RF sin criterio de aceptación / dudas abiertas

- **R1.** RF-2 (push a `main`) y RF-8 (solo docs) no están en ninguna historia ni tienen
  aceptación propia más allá del caso 2.

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A3, K1–K2, C1–C3, T1–T2, R1)

## Ronda 2 — 16/11

Revisión de la spec corregida (resoluciones aprobadas por el usuario).

| Detección | Dónde quedó resuelta | Estado |
|---|---|---|
| A1 | RF-3 y RF-5: job `gates` con nombre fijo; renombrarlo obliga a actualizar la regla | Resuelta |
| A2 | RF-7: artefacto solo si la cobertura llegó a correr; si no, no es error | Resuelta |
| A3 | Criterios de finalización: `nestjs-tp/README.md` y `validate.md` | Resuelta |
| K1 | RF-3/RF-4: script `typecheck`; todos los pasos son scripts | Resuelta |
| K2 | RF-9: una rama por TP + PR que mergea el usuario; `ci.yml` a `main` antes de la regla | Resuelta |
| C1 | RNF-6 y caso 10: tiempo máximo 15 min | Resuelta |
| C2 | RNF-6 y caso 11: cancela la corrida anterior | Resuelta |
| C3 | RNF-7: `packageManager: pnpm@12.6.0`, Node 24 | Resuelta |
| T1 | Casos 7 y 9 con método de verificación (YAML y log de permisos) | Resuelta |
| T2 | RNF-2: búsqueda de patrones documentada en `validate.md` | Resuelta |
| R1 | HU-1 cubre RF-2 y RF-8 | Resuelta |

Verificaciones de la ronda 2:

- RF-9 es coherente con la autorización de commits del proyecto: los commits del flujo SDD
  se siguen haciendo, en la rama del TP en lugar de `main`; el push sigue requiriendo OK.
- Lo que el TP-6 haga **después** de activar la regla (evidencia en el README, `validate.md`)
  también entra por rama + PR, según RF-9: no hay excepción implícita.
- Los cambios en `package.json` (script y `packageManager`) no agregan dependencias (RNF-5
  de la spec 005 y `AGENTS.md`).

**VEREDICTO: APROBADA**
