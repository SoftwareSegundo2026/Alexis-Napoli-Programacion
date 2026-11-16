VEREDICTO: APROBADO

# Validación 003 — Motor de búsqueda de pistas (TP-3)

Fecha: 16/11/2026 · Rol: reviewer · Rama `tp-3-busqueda`
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `docs/constitution.md`,
`consignas/TP3-motor-busqueda.md`, el código compilado y `git log`.

> **Hallazgo durante la validación (ya corregido):** la primera pasada encontró que el SQL
> ejecutado traía los filtros numéricos escritos como literales (`"GenreId" = 7`): el driver de
> SQLite de TypeORM inlinea todo parámetro `number`. No era inyectable (el valor ya era un número
> validado), pero contradecía RNF-3. Con aprobación del usuario se agregó la **T5** (`53bdb81`
> precisa RNF-3 y crea la tarea; `219c9da` la implementa con test en rojo primero). Este informe
> es la validación **después** de T5.

## Gates (ejecutados en esta validación)

| Gate | Comando | Resultado |
|---|---|---|
| Lint | `pnpm lint` | ✅ exit 0, 0 avisos |
| Build | `pnpm build` | ✅ exit 0 |
| Unit | `pnpm test` | ✅ 360/360 |
| e2e | `pnpm test:e2e` | ✅ 413/413 (incluye el contrato y los 21 casos del buscador) |
| Cobertura | `pnpm test:cov` | ✅ líneas 78,56% (143 sin cubrir), ramas 83,96% (42 sin cubrir); umbral 75/75 |
| Tipos | `pnpm typecheck` | ✅ exit 0 |

## Requisitos → tests → resultado

| RF | Qué exige | Tests | Resultado |
|---|---|---|---|
| RF-1 | Sin filtros: todo, paginado | repository › "sin filtros: la primera página…" · e2e caso 10 · DTO › defaults | ✅ |
| RF-2 | `q` en nombre o compositor, sin mayúsculas (Unicode), acentos distinguen | repository › filtro de texto (oráculo), mayúsculas no ASCII, acentos · e2e casos 5 y 14 | ✅ |
| RF-3 | Filtros combinados con Y | repository › "los 5 filtros a la vez" (oráculo) · e2e caso 3 | ✅ |
| RF-4 | Artista vía álbum; pista sin álbum no coincide | repository › artista (oráculo), "una pista sin álbum no coincide" · e2e caso 3 | ✅ |
| RF-5 | Orden por whitelist con desempate por id; `name` sin mayúsculas; inválido → 400 | repository › 7 combinaciones de orden contra el oráculo · DTO › whitelist · e2e casos 4, 15 y 21 | ✅ |
| RF-6 | `total`, `skip`/`limit` aplicados, `hasMore` | `page.dto.spec` · `tracks.service.spec` › search · e2e casos 1, 2, 10, 19 · contrato (forma `page`) | ✅ |
| RF-7 | Sin coincidencias / `skip` > total → 200 `[]` | repository y e2e casos 1 y 2 | ✅ |
| RF-8 | Texto literal: parámetro y `%`/`_` sin comodín | `escape-like.spec` · repository › `%`, `_`, inyección · e2e casos 5 y 6 | ✅ |
| RF-9 | Validación antes del repository; 400 que nombra el parámetro | `search-tracks-query.dto.spec` (41 tests) · e2e casos 4, 8, 9, 11, 13, 18, 20 | ✅ |
| RF-10 | Relaciones vacías no excluyen | repository › "pista sin género ni álbum aparece" · e2e caso 7 | ✅ |
| RF-11 | Id inexistente → 200 `[]` | repository › ids inexistentes · e2e caso 12 | ✅ |
| RF-12 | Documentación de cada parámetro | e2e › "RF-12: la documentación describe los 11 parámetros con su tipo" · contrato (inventario) | ✅ |

## Requisitos no funcionales

| RNF | Evidencia | Resultado |
|---|---|---|
| RNF-1 — todo en la base | Test con `RecordingLogger`: la página lleva `LIMIT`/`OFFSET` y el total es un `COUNT` aparte; nunca se traen todas las filas | ✅ |
| RNF-2 — índices | Medición en `plan.md` (índice temporal: solo ~0,18 ms en precio exacto → no se agregan). Plan del SQL **real** (código compilado, esta validación): género → `SEARCH track USING INDEX IFK_TrackGenreId`; artista → `SEARCH album USING INDEX IFK_AlbumArtistId` + `SEARCH track USING INDEX IFK_TrackAlbumId`; texto → `SCAN track` (esperado: `LIKE '%x%'`); los `LEFT JOIN` por clave primaria | ✅ |
| RNF-3 — cero concatenación | SQL real tras T5: `"GenreId" = CAST(? AS INTEGER)`, `"UnitPrice" >= CAST(? AS REAL)`…, parámetros `["%abc%","%abc%","7","0.5","300001"]`. Test: con los 7 filtros, ningún valor en el SQL. Búsqueda en `src/`: ninguna cláusula con plantilla `${…}` ni `+`; el orden sale del mapa fijo `SORT_COLUMNS`. `LIMIT`/`OFFSET` literales del QueryBuilder (enteros validados), como precisa la spec | ✅ |
| RNF-4 — contrato y cobertura | 2 casos de contrato (200 con forma `page`, 400); inventario en verde; cobertura 78,56% / 83,96% | ✅ |
| RNF-5 — rama + PR | Todo en `tp-3-busqueda`; entra por PR | ✅ (al mergear) |
| RNF-6 — forma única de metadatos | `Page<T>` + `toPage()` en `common/dto/page.dto.ts`; `TrackSearchPageDto implements Page<…>` | ✅ |

## Casos límite (1–21)

Los 21 casos tienen su test por HTTP en `test/tracks-search.e2e-spec.ts`, numerados igual que en la
spec (31 tests con variantes), y la mayoría además a nivel repository o DTO (ver tabla de RF).

## Consigna

| Exigencia | Evidencia |
|---|---|
| Filtros combinados sobre ≥ 2 recursos relacionados | Pista + género + álbum → artista (RF-3, RF-4) |
| Orden por whitelist | `@IsIn` + mapa `SORT_COLUMNS` (RF-5) |
| Paginación con `total`, `skip`, `limit`, `hasMore` | RF-6 |
| Consultas paginadas en la base e índices con evidencia | RNF-1, RNF-2 (medición + plan real) |
| Query params documentados | RF-12 |
| Las 6 decisiones justificadas en la spec | Tabla de parámetros, RF-1, RF-5, RF-7, RF-8, RF-9 |
| Ninguna consulta concatena el valor del query param | RNF-3 (tras T5) |
| Metadatos consistentes | RNF-6 |

## Proceso

Spec + clarify (`16c5937`; ronda 1 con 10 detecciones, ronda 2 APROBADA) → plan y tareas
(`be66149`) → T1 `3994ae2` · T2 `21db48d` · T3 `9acff3b` · T4 `ab57168` → hallazgo de la
validación → T5 aprobada (`53bdb81`) e implementada (`219c9da`). `MEMORY.md` en cada tarea.

## Observaciones (no bloquean)

1. **Tests anteriores actualizados en T3** (no borrados ni debilitados): `protection.e2e` suma
   exactamente `GET /tracks/search` a las operaciones públicas (su lista exige un cambio de spec:
   lo es la 003) y pasa de 25 a 26 operaciones; `docs.e2e` pasa de 20 a 21 rutas de catálogo y de
   25 a 26 en total.
2. El oráculo del test del repository encontró un bug durante T2 (un segundo orden por
   `track.id` pisaba el pedido por el cliente), corregido antes del commit.
3. Lo sin cubrir subió de 135 a 143 líneas en T3: es el controller de pistas, que no tiene test
   unitario y lo cubren los e2e; la cobertura sigue sobre el umbral.
4. **Fuera del TP-3:** los demás repositories (`findById` de cada recurso, etc.) también pasan
   ids numéricos que el driver escribe como literal. No es inyectable (son números validados por
   `ParseIntPipe`); queda anotado para revisarlo en un TP futuro.
5. `sort=name` ordena las letras acentuadas por su código (después de la `z`), documentado en
   RF-5 como límite aceptado.
