# Tareas 005 — Suite de calidad: cobertura, TDD y contrato (TP-5)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/005-calidad/plan.md` (aprobado el 16/11)

Reglas: una tarea por vez, tests primero (en rojo), **5 gates** en verde
(`pnpm lint && pnpm build && pnpm test && pnpm test:e2e && pnpm test:cov`, más
`pnpm exec tsc --noEmit -p tsconfig.json`), un commit `005-Tn: …`, `[x]` acá y `MEMORY.md`
actualizado con la cobertura (porcentajes y líneas/ramas sin cubrir). Después, **PARA**.
Ninguna tarea aumenta las líneas ni las ramas sin cubrir (RNF-1).
T4–T6 llevan **dos commits**: `005-Tn (rojo)` (solo los tests nuevos, fallando por el bug;
sin `[x]`) y `005-Tn` (el arreglo, sin tocar esos tests; con `[x]`) — RNF-4.

- [x] **T1. Gate de cobertura.** RF-1, RF-2 · casos 1, 2, 18
      Bloque `coverage` en `vitest.config.ts`: `include: src/**/*.ts`, `exclude:
      src/**/*.spec.ts`, umbral líneas 75 y ramas 75, reportes `text-summary` y `json-summary`.
      Mutaciones (se revierten y se documentan): umbral de líneas en 80 → falla; un test roto
      → falla. Se registra la línea de base.
      Hecho cuando: `pnpm test:cov` sale con código 0 y el resumen muestra líneas ≥ 75 y
      ramas ≥ 75 medidas sobre todo `src/` (un archivo sin tests figura con 0%); con cada
      mutación sale con código ≠ 0.
      Estimación: 15 min · depende de: —

- [ ] **T2. Contrato: infraestructura y catálogo.** RF-3, RF-5 (parcial RF-4)
      `test/contract/shapes.ts` (formas de artista, género, álbum, pista, error y el
      verificador de claves exactas y tipos), `catalog.cases.ts` (las 20 operaciones del
      catálogo: éxito y cada código documentado) y `contract.e2e-spec.ts` (un `it.each` con
      el nombre `operación · código · caso`).
      Mutaciones (se revierten y se documentan): quitar un campo de `ArtistResponseDto` →
      falla nombrando la operación; `UnitPrice` como texto → falla; `POST /genres` con 200 en
      vez de 201 → falla.
      Hecho cuando: `pnpm test:e2e` pasa con los casos de las 20 operaciones del catálogo, y
      cada mutación hace fallar el caso correspondiente.
      Estimación: 45 min · depende de: T1

- [ ] **T3. Contrato: login, usuarios e inventario.** RF-4 · casos 3–6
      `users.cases.ts` (`POST /auth/token`, `GET /users`, `GET /users/me`, `POST /users`,
      `PATCH /users/{id}`) y el inventario: lee `/docs-json`, arma los pares (operación,
      código documentado) y falla si a alguno le falta un caso o si un caso apunta a un par
      no documentado.
      Mutación (se revierte y se documenta): un `@ApiNotFound()` agregado a una operación sin
      caso de 404 → el inventario falla nombrando el par.
      Hecho cuando: `pnpm test:e2e` pasa con las 25 operaciones cubiertas y el inventario en
      verde; con la mutación, falla.
      Estimación: 35 min · depende de: T2

- [ ] **T4. Bug 1: `skip` enorme → 500.** RF-6 · casos 7, 8, 17
      Rojo: `pagination-query.dto.spec.ts` (skip de 20 y de 400 dígitos se aceptan; `limit`
      enorme sigue → 400) y e2e de los 5 listados con `?skip=99999999999999999999` → 200 `[]`.
      Arreglo: `toStrictInteger` topa en `Number.MAX_SAFE_INTEGER`.
      Hecho cuando: en el commit `(rojo)` `pnpm test` y `pnpm test:e2e` fallan **solo** en los
      tests nuevos (salida guardada); en el commit del arreglo los 5 gates pasan, sin cambios
      en esos tests.
      Estimación: 25 min · depende de: T3

- [ ] **T5. Bug 2: duplicados con mayúsculas no ASCII.** RF-7 · casos 9, 10, 11, 19
      Rojo: e2e de artistas y géneros (`CANCIÓN ÑANDÚ` / `canción ñandú` / `BJÖRK PRUEBA` →
      409 en alta y modificación; `Cancion` frente a `Canción` → 201; `STRASSE` frente a
      `Straße` → 201).
      Arreglo: `src/database/sql-functions.ts` (`unicode_lower`, determinística) registrada en
      `prepareDatabase`; `existsWithName` de artistas y géneros la usa. Unit de `unicode_lower`
      en el commit del arreglo. Verificación con la app real.
      Hecho cuando: en el commit `(rojo)` `pnpm test:e2e` falla **solo** en los casos de 409
      (salida guardada); en el commit del arreglo los 5 gates pasan, sin cambios en esos tests,
      y la app real responde 409 a `CANCIÓN ÑANDÚ` tras `Canción Ñandú`.
      Estimación: 35 min · depende de: T4

- [ ] **T6. Bug 3: opcional vacío o de espacios → `null`.** RF-8 · casos 12–15
      Rojo: tests de DTO vía `RequestValidationPipe` (`ImageUrl` de artista y álbum, `Composer`,
      `full_name` con `""` y `"   "` → `null`; `Name` con espacios sigue → 400) y e2e de alta
      de artista y `PATCH` de pista.
      Arreglo: decorador `@TrimToNull()` en los opcionales de texto (no en los obligatorios).
      Hecho cuando: en el commit `(rojo)` `pnpm test` y `pnpm test:e2e` fallan **solo** en los
      tests nuevos (salida guardada); en el commit del arreglo los 5 gates pasan, sin cambios
      en esos tests.
      Estimación: 30 min · depende de: T5

- [ ] **T7. Refactor del PATCH con red de seguridad.** RF-9 · caso 16
      `src/common/patch/assign-defined.ts`; `update()` de artistas, álbumes, géneros y pistas
      lo usan (las verificaciones previas no se mueven).
      Hecho cuando: los 5 gates pasan; `git show --stat` del commit no lista **ningún**
      archivo de test; las líneas y ramas sin cubrir (`coverage-summary.json`) son ≤ las de T6.
      Estimación: 20 min · depende de: T6

Después de T7: `validate.md` (VEREDICTO en la primera línea; tabla RF/caso → test o
mutación → resultado) y commit `005: validate — VEREDICTO: …`.
