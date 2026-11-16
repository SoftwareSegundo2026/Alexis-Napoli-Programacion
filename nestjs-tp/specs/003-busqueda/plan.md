# Plan 003 — Motor de búsqueda de pistas (TP-3)

Estado: **aprobado** (16/11, Alexis Napoli) · Spec: `specs/003-busqueda/spec.md` (aprobada el 16/11, clarify ronda 2)

## Dependencias nuevas

**Ninguna.** TypeORM (QueryBuilder), class-validator y class-transformer ya están.

## Medición de índices (RNF-2) — sobre una copia de la base, nunca la versionada

Script `measure-indexes.mjs` (scratchpad): misma forma de consulta que el buscador (pistas con
`LEFT JOIN` a álbum y género, página de 100 + `COUNT`), 400 repeticiones por escenario, primero
sin índices nuevos y después con índices temporales en `UnitPrice` y `Milliseconds` + `ANALYZE`.

| Escenario | Total | Sin índice | Con índice | Plan con índice |
|---|---|---|---|---|
| Precio angosto (1,99) | 213 | 429 µs | **245 µs** | `SEARCH … USING INDEX tmp_track_price` |
| Precio amplio (0–1) | 3290 | 448 µs | 556 µs | `SCAN t` (SQLite no lo usa) |
| Duración angosta (2–3 min) | 387 | 357 µs | 344 µs | `SCAN t` (no lo usa) |
| Duración amplia (0–5 min) | 2434 | 418 µs | 465 µs | `SCAN t` (no lo usa) |
| Género 1 + precio | 1297 | 322 µs | 379 µs | `SEARCH … USING INDEX IFK_TrackGenreId` |
| Artista 22 + duración | 60 | 167 µs | 236 µs | `SEARCH a USING COVERING INDEX IFK_AlbumArtistId` → `IFK_TrackAlbumId` |
| Texto "love" | 174 | 1534 µs | 1472 µs | `SCAN t` (con o sin índice) |

**Conclusión:** el único caso que mejora (precio de un solo valor) gana ~0,18 ms sobre una
respuesta HTTP de varios milisegundos; en los demás SQLite descarta el índice o empeora levemente,
y todo índice suma costo a cada alta y modificación de pista. **No es una mejora relevante: la
decisión 4 se mantiene** (RNF-2). Género y artista ya usan los índices de las claves foráneas.
El texto recorre la tabla con o sin índice, como anticipaba la spec.

## Estructura (lo nuevo y lo que cambia)

```
src/common/dto/
├── pagination-query.dto.ts     ← exporta toStrictInteger (hoy es privada)
└── page.dto.ts                 ← NUEVO: interfaz Page<T> + toPage() (RNF-6, forma única)
src/common/validation/
└── is-not-less-than.decorator.ts ← NUEVO: "maxPrice no menor que minPrice" (RF-9)
src/tracks/
├── dto/search-tracks-query.dto.ts ← NUEVO: q, genreId, artistId, rangos, sort, order (+ skip/limit)
├── dto/track-search-page.dto.ts   ← NUEVO: respuesta documentada { items, total, … }
├── escape-like.ts                 ← NUEVO: escapa \ % _ para LIKE (RF-8)
├── tracks.repository.ts           ← search(filters): QueryBuilder + getManyAndCount
├── tracks.service.ts              ← search(): arma la página (hasMore)
└── tracks.controller.ts           ← @Get('search') ANTES de @Get(':id')
test/
├── tracks-search.e2e-spec.ts      ← NUEVO: casos límite de la spec
└── contract/shapes.ts, catalog.cases.ts ← forma "página" + casos del endpoint nuevo
```

## Decisiones (y por qué), contra la constitution

- **QueryBuilder con parámetros nombrados** (`:genreId`, `:q`…), nunca interpolación de valores
  (RNF-3). Los nombres de columna del `ORDER BY` salen de un mapa fijo
  (`{ trackId, name, unitPrice, milliseconds }` → expresión SQL); el valor de `sort` solo elige
  una clave del mapa, ya validada por `@IsIn` en el DTO (RF-5).
- **`LEFT JOIN` a álbum, género y tipo de medio:** una pista sin género o sin álbum no
  desaparece (RF-10); `artistId` filtra por `album.ArtistId`, así que una pista sin álbum no
  coincide (RF-4).
- **Texto:** `unicode_lower(track.Name) LIKE :q ESCAPE '\'` (y lo mismo con `Composer`), con
  `:q = '%' + escapeLike(unicodeLower(q)) + '%'`. Se reutiliza la función SQL del TP-5, así la
  regla de mayúsculas es idéntica en todo el sistema (RF-2). `escapeLike` antepone `\` a `\`, `%`
  y `_` para que se busquen literalmente (RF-8, caso 5).
- **Orden estable:** `ORDER BY <campo> <sentido>, track.TrackId ASC` (RF-5, caso 15). Para
  `name`, la expresión es `unicode_lower(track.Name)` (caso 21).
- **Paginación en la base:** `.offset(skip).limit(limit)` (no `skip/take`: con relaciones
  muchos-a-uno no se multiplican filas, y `offset/limit` genera SQL directo, sin la subconsulta
  de `DISTINCT` que TypeORM arma con `take`). `getManyAndCount()` corre la página y un `COUNT`
  aparte (RF-6, RNF-1).
- **`Page<T>` + `toPage(items, total, skip, limit)`** calcula `hasMore` en un solo lugar
  (RNF-6). Para Swagger, una clase concreta `TrackSearchPageDto` (Swagger no documenta genéricos).
- **Validación en el DTO, antes del repository** (RF-9): se reusan `toStrictInteger` y las reglas
  de `PaginationQueryDto` (por herencia); precios con `toStrictDecimal` (`^\d+(\.\d{1,2})?$`);
  `@IsIn` para `sort` y `order`; un decorador propio compara mínimo y máximo. Un parámetro
  repetido llega como lista y falla la validación de tipo → 400 (caso 18).
- **Ruta `search` antes de `:id`:** si no, Nest toma "search" como id y `ParseIntPipe` responde 400.
- Capas: el controller solo traduce HTTP; el service arma la página; el repository arma el SQL.

## Estrategia de tests

| Tarea | Tests (primero en rojo) |
|---|---|
| T1 | `page.dto.spec` (hasMore en bordes) · `search-tracks-query.dto.spec` vía `RequestValidationPipe` (formatos, rangos, whitelist, repetidos, `q` vacío/largo, mínimo > máximo) |
| T2 | `escape-like.spec` · `tracks-search.repository.spec` contra una **copia real** de la base (con `prepareDatabase`): cada filtro, los 5 juntos, relaciones vacías, orden y desempate, `%`/`_`/`'`/inyección como texto, y **el SQL generado** (`LIMIT`/`OFFSET`, `COUNT` aparte, el texto de `q` solo en los parámetros) |
| T3 | `tracks.service.spec` (página y metadatos) · contrato: forma `page` en `shapes.ts` + casos 200/400 del endpoint (el inventario del TP-5 los exige apenas el endpoint existe) |
| T4 | `tracks-search.e2e-spec` (los 21 casos de la spec por HTTP) · test de `/docs-json` con los 11 parámetros (RF-12) |

## Riesgos

- **`unicode_lower` no registrada** en una conexión de test → "no such function". El spec del
  repository usa la misma opción `prepareDatabase` que `DatabaseModule`.
- **Cobertura:** código nuevo con sus tests en la misma tarea; se registra lo sin cubrir en cada una.
- **Contrato:** el inventario del TP-5 falla en cuanto el endpoint aparece en `/docs-json` sin
  casos; por eso los casos de contrato van en la MISMA tarea que crea el endpoint (T3), para
  que ninguna tarea cierre con un gate en rojo. Es el inventario funcionando como se diseñó.

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

1. **T1** — `Page<T>`/`toPage` y `SearchTracksQueryDto` con todas las validaciones.
2. **T2** — `escapeLike` y `TracksRepository.search` contra la base real.
3. **T3** — Service + `GET /tracks/search` + documentación Swagger + casos de contrato.
4. **T4** — e2e de los 21 casos límite y test de documentación de los parámetros.
