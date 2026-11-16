# Tareas 003 — Motor de búsqueda de pistas (TP-3)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/003-busqueda/plan.md` (aprobado el 16/11)

Reglas: una tarea por vez, tests primero (en rojo), gates en verde (`pnpm lint && pnpm build &&
pnpm test && pnpm test:e2e && pnpm test:cov && pnpm typecheck`), un commit `003-Tn: …` en la rama
`tp-3-busqueda`, `[x]` acá y `MEMORY.md` actualizado con la cobertura (líneas/ramas sin cubrir).
Después, **PARA**. Push de la rama con OK del usuario; entra a `main` por PR (spec 006 RF-9).

- [x] **T1. Página y validación de los parámetros.** RF-6 (parcial), RF-9, RNF-6 · casos 8, 9, 11, 13, 18, 20
      `src/common/dto/page.dto.ts` (`Page<T>`, `toPage`); exportar `toStrictInteger`;
      `toStrictDecimal`; decorador mínimo ≤ máximo; `SearchTracksQueryDto` (hereda `skip`/`limit`).
      Hecho cuando: `pnpm test` pasa `page.dto.spec` (`hasMore` con resultados, sin resultados,
      `skip` > total, última página exacta) y `search-tracks-query.dto.spec` vía
      `RequestValidationPipe` (cada regla de la tabla de parámetros con su 400 que nombra el
      parámetro; valores válidos convertidos a número; defaults de `sort`/`order`).
      Estimación: 30 min · depende de: —

- [x] **T2. Búsqueda en el repository.** RF-1–RF-5, RF-7, RF-8, RF-10, RF-11, RNF-1, RNF-3 · casos 1–7, 10, 12, 14, 15, 17, 21
      `src/tracks/escape-like.ts`; `TracksRepository.search(filters)` con QueryBuilder,
      `LEFT JOIN`, parámetros nombrados, orden por mapa fijo + desempate, `offset/limit`,
      `getManyAndCount`.
      Hecho cuando: `pnpm test` pasa `escape-like.spec` y `tracks-search.repository.spec` contra
      una copia real de la base (cada filtro, los 5 juntos, pistas sin género presentes, artista
      vía álbum, ids inexistentes → vacío, `%`/`_`/`'`/inyección literales, orden y desempate,
      `sort=name` sin mayúsculas, y el SQL generado con `LIMIT`/`OFFSET`, `COUNT` aparte y el
      texto de `q` solo en los parámetros).
      Estimación: 45 min · depende de: T1

- [ ] **T3. Endpoint `GET /tracks/search` y su contrato.** RF-6, RF-12 (Swagger), RNF-4, RNF-6
      `TracksService.search` (arma la página con `toPage`); ruta `search` antes de `:id`, pública,
      con `TrackSearchPageDto` y los parámetros documentados; `shapes.ts` con la forma `page`;
      casos de contrato 200 y 400.
      Hecho cuando: `pnpm test` pasa los tests nuevos de `tracks.service.spec`; `pnpm test:e2e`
      pasa con el inventario del contrato en verde (el endpoint con sus casos); `GET /tracks/1`
      sigue respondiendo (la ruta `search` no lo pisa).
      Estimación: 35 min · depende de: T2

- [ ] **T4. Casos límite por HTTP y documentación de parámetros.** RF-1–RF-12 · casos 1–21
      `test/tracks-search.e2e-spec.ts` con los 21 casos de la spec; test de `/docs-json` con los
      11 parámetros y sus tipos.
      Hecho cuando: `pnpm test:e2e` pasa los 21 casos y el test de documentación; mutación: quitar
      el `escapeLike` → falla el caso 5 (se revierte y se documenta).
      Estimación: 35 min · depende de: T3

Después de T4: `validate.md` (VEREDICTO en la primera línea; RF/casos → test; plan de consulta;
búsqueda de concatenación en el código), push de la rama con OK, PR y merge por el usuario.
