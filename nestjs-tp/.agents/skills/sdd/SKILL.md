---
name: sdd
description: Flujo Spec-Driven Development (DevelopAI) de los TPs de NestJS. Usala siempre que se escriba o revise una spec, un plan, una lista de tareas, se implemente una tarea o se valide una entrega.
---

# SDD — Spec-Driven Development

> La IA ejecuta, pero el responsable del proyecto es el alumno.
> La spec manda: nada se implementa si no está en la spec aprobada.

## Flujo y gates de aprobación

```
constitution → spec ─PARA─ → clarify → plan ─PARA─ → tasks ─PARA─ → implement T1..Tn → validate
```

- Nunca se pasa de fase sin la aprobación **explícita** del usuario.
- Cada fase deja un artefacto en `specs/NNN-nombre/`.
- Requisito nuevo o cambiado: `/sdd-change` → primero la spec, después el código.
- Validación con `VEREDICTO: CAMBIOS NECESARIOS` → vuelve a implementación (máx. 2 vueltas).

## Estados de los artefactos

`Estado: borrador` → `Estado: aprobada` (spec) / `Estado: aprobado` (plan, tareas).
La línea de estado va arriba de cada archivo y la cambia solo la aprobación del usuario.

## Plantilla de spec (`spec.md`) — QUÉ y POR QUÉ

1. Contexto y objetivo
2. Usuarios (tabla rol → qué hace)
3. Historias de usuario (`HU-n. Como …, quiero …, para …`) con criterio de aceptación
4. Requisitos funcionales en EARS (`RF-n`)
5. Requisitos no funcionales (`RNF-n`), medibles
6. Casos límite
7. Fuera de alcance
8. Criterios de finalización
9. Dudas abiertas: `[NECESITA ACLARACIÓN]` (no puede quedar ninguna al aprobar)

**No va en la spec:** framework, librerías, arquitectura, nombres de archivos,
diseño de la base, algoritmos, estimaciones, "rápido/escalable" sin número.

Antes de escribirla: máximo 5 preguntas al usuario, de a una. Las respuestas se
registran en la spec (sección "Decisiones de la entrevista").

## EARS

| Forma | Uso | Ejemplo |
|---|---|---|
| CUANDO / MIENTRAS | evento o estado | CUANDO se solicita `GET /x`, EL SISTEMA devuelve … |
| SI … ENTONCES | condición no deseada | SI el id no existe, ENTONCES EL SISTEMA responde 404 |
| A MENOS QUE | excepción | A MENOS QUE el usuario sea admin, EL SISTEMA responde 403 |
| EL SISTEMA DEBE | requisito fijo / no funcional | EL SISTEMA DEBE limitar `limit` a 100 |

Un requisito sin condición y resultado observables no se puede testear: se reescribe.

## Plan (`plan.md`) — CÓMO

Módulos y archivos (controller → service → repository → DTO), tabla archivo → RF,
decisiones con su porqué contra `docs/constitution.md`, estrategia de tests
(unit del service con repository mockeado + e2e con supertest, qué RF cubre cada tanda)
y riesgos.

## Tareas (`tasks.md`)

```
- [ ] **T5. DTOs con validación global.** RF-4
      Hecho cuando: `pnpm test:e2e` pasa el test de datos inválidos (400).
```

- Máximo **10** por spec (si no entra, se parte la spec), 20-30 min cada una.
- Orden de dependencia. Tests antes (o junto) del código.
- "Hecho cuando:" verificable con un comando.

## Implementar una tarea

1. Test en rojo → 2. código mínimo → 3. test en verde (sin tocar el test) →
4. gates `pnpm lint && pnpm build && pnpm test && pnpm test:e2e` →
5. un commit `Tn: …` (o `NNN-Tn: …`), `[x]` en `tasks.md`, `MEMORY.md` actualizado → **PARA**.

Prohibido: borrar o comentar tests, marcar `[x]` con un gate en rojo, empezar la tarea siguiente.

## Validar

Tabla `RF | test que lo cubre | resultado`. Un RF sin test **no está implementado**.
Primera línea: `VEREDICTO: APROBADO` o `VEREDICTO: CAMBIOS NECESARIOS`.
