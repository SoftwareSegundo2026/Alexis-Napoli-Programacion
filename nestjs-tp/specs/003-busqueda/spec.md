# Spec 003 — Motor de búsqueda de pistas (TP-3)

Estado: **aprobada** (16/11, Alexis Napoli) · Se apoya en las specs 001, 002 y 005 (aprobadas y validadas)

## Contexto y objetivo

El catálogo solo permite listar pistas de a páginas, en orden de id. Para encontrar
"los temas de rock de AC/DC de menos de 4 minutos, del más barato al más caro" hay que
traer todo y filtrar a mano. Este cambio agrega un **buscador de pistas** con filtros
combinables sobre la pista y sus relaciones (género, álbum y artista), orden elegible y
paginación con metadatos, resuelto **en la base** y sin armar SQL con el texto del cliente.

## Usuarios

| Rol | Qué hace |
|---|---|
| Visitante (sin cuenta) | Busca pistas combinando filtros; la búsqueda es una lectura pública, como el resto del catálogo |
| Desarrollador de un cliente | Pagina resultados sabiendo cuántos hay en total y si quedan más |

## Historias de usuario

- **HU-1.** Como visitante, quiero buscar pistas por texto en el nombre o el compositor,
  para encontrarlas sin saber su id.
  *Aceptación:* `q=highway` devuelve las pistas cuyo nombre o compositor lo contienen, sin
  distinguir mayúsculas (RF-2).
- **HU-2.** Como visitante, quiero combinar filtros de género, artista, precio y duración,
  para acotar la búsqueda.
  *Aceptación:* los 5 filtros juntos devuelven solo lo que cumple todos (RF-3, RF-4).
- **HU-3.** Como visitante, quiero ordenar los resultados por nombre, precio o duración, en
  forma ascendente o descendente.
  *Aceptación:* `sort=unitPrice&order=desc` ordena del más caro al más barato (RF-5).
- **HU-4.** Como desarrollador de un cliente, quiero saber cuántos resultados hay y si
  quedan más, para armar la paginación.
  *Aceptación:* la respuesta trae `total`, `skip`, `limit` y `hasMore` (RF-6).
- **HU-5.** Como responsable de seguridad, quiero que ningún texto del cliente pueda
  alterar la consulta.
  *Aceptación:* caracteres especiales e intentos de inyección SQL se buscan como texto
  literal (RF-8).

## Contrato

- `GET /api/v1/tracks/search` — **público** (sin credencial, como las demás lecturas del
  catálogo; spec 002 RF-5). Los listados existentes **no cambian** (decisión 1).
- Respuesta 200:
  `{ "items": [<pista>, …], "total": <n>, "skip": <n>, "limit": <n>, "hasMore": <bool> }`.
  Cada `<pista>` tiene exactamente los campos de `GET /tracks` (spec 001 RF-5).
- Errores: `{"detail": "<mensaje>"}` con un mensaje que nombra el parámetro (spec 001 RF-9).

| Parámetro | Tipo y regla | Significado |
|---|---|---|
| `q` | Texto, 1 a 100 caracteres tras recortar espacios | Contenido en `Name` o `Composer` |
| `genreId` | Entero ≥ 1 | Pistas de ese género |
| `artistId` | Entero ≥ 1 | Pistas de álbumes de ese artista |
| `minPrice`, `maxPrice` | Texto `123` o `123.45` (dígitos, opcionalmente punto y 1–2 decimales); `1,5`, `1e2`, `.5`, `+1` → 400 | `UnitPrice` dentro del rango (extremos incluidos) |
| `minMs`, `maxMs` | Entero ≥ 0 escrito "en limpio" (misma regla que `skip`) | `Milliseconds` dentro del rango (extremos incluidos) |
| `sort` | `trackId` (por defecto), `name`, `unitPrice`, `milliseconds` | Campo de orden |
| `order` | `asc` (por defecto) o `desc` | Sentido del orden |
| `skip`, `limit` | Los mismos de los listados: `skip` ≥ 0 (default 0), `limit` 1–100 (default 100) | Paginación |

Cada parámetro admite **un solo valor**: repetido (`genreId=1&genreId=2`) → 400 que lo nombra.

## Requisitos funcionales (en EARS)

- **RF-1:** CUANDO se busca sin ningún filtro, EL SISTEMA devuelve todas las pistas,
  paginadas (decisión 3).
- **RF-2:** CUANDO llega `q`, EL SISTEMA devuelve las pistas cuyo `Name` o `Composer`
  contiene ese texto, sin distinguir mayúsculas en ninguna letra (la misma regla de
  minúsculas de Unicode de la spec 005 RF-7); los acentos sí distinguen.
- **RF-3:** CUANDO llegan varios filtros, EL SISTEMA devuelve solo las pistas que cumplen
  **todos** (combinación con Y).
- **RF-4:** CUANDO llega `artistId`, EL SISTEMA filtra por el artista del álbum de la pista
  (relación pista → álbum → artista); una pista sin álbum no coincide con ningún artista.
- **RF-5:** EL SISTEMA ordena por el campo de `sort` en el sentido de `order` y, a igualdad,
  por `TrackId` ascendente, para que la paginación sea estable. `sort=name` compara sin
  distinguir mayúsculas (la misma `unicode_lower`); las letras acentuadas se ordenan por su
  código, después de la `z` (un orden "de diccionario" queda fuera de alcance). SI `sort` u
  `order` no está en su lista permitida, ENTONCES responde 400 que nombra el parámetro.
- **RF-6:** EL SISTEMA responde `total` = cantidad de pistas que cumplen los filtros (sin
  paginar), `skip` y `limit` = los **aplicados** (un `skip` enorme se informa ya topado en
  `Number.MAX_SAFE_INTEGER`, spec 005 RF-6), y `hasMore` = `skip + items.length < total`.
- **RF-7:** SI ninguna pista cumple los filtros, o `skip` supera el total, ENTONCES EL
  SISTEMA responde 200 con `items: []` y los metadatos coherentes (nunca 404).
- **RF-8:** EL SISTEMA trata el texto de `q` como texto **literal**: nunca se concatena en
  el SQL (va como parámetro) y los comodines `%` y `_` se buscan como caracteres comunes.
- **RF-9:** SI un parámetro no cumple su regla (formato, rango, `q` vacío o de más de 100
  caracteres, valor repetido) o un mínimo supera a su máximo, ENTONCES EL SISTEMA responde
  400 que nombra el parámetro, **antes** de consultar la base. Mínimo igual a máximo es
  válido (valor exacto). Los parámetros desconocidos se ignoran,
  como en los listados.
- **RF-10:** CUANDO no se filtra por género ni por artista, una pista sin género o sin álbum
  **aparece** en los resultados (las relaciones vacías no la excluyen).
- **RF-11:** CUANDO un `genreId` o `artistId` no existe, EL SISTEMA responde 200 con
  `items: []` (es un filtro que no coincide, no un recurso inexistente).
- **RF-12:** La documentación interactiva describe el endpoint, cada parámetro con su
  regla y la forma de la respuesta. Se verifica con un test sobre `/docs-json` (los 11
  parámetros con su tipo).

## Requisitos no funcionales

- **RNF-1:** El filtrado, el orden, el conteo y la paginación se hacen **en la base**: nunca
  se cargan todas las pistas para filtrarlas en memoria. Se verifica inspeccionando el SQL
  generado (tiene `LIMIT`/`OFFSET` y un `COUNT` aparte).
- **RNF-2 (índices — justificación, decisión 4):**
  - **Género y artista** usan los índices existentes de las claves foráneas
    (`IFK_TrackGenreId`, `IFK_AlbumArtistId`); se muestra con el plan de consulta.
  - **Texto:** `LIKE '%x%'` empieza con comodín, y un índice B-tree solo sirve para buscar por
    el **comienzo** del texto: ningún índice común acelera "contiene". Sería necesaria una
    búsqueda full-text, que está fuera de alcance.
  - **Precio y duración:** filtran rangos sobre 3503 filas. El plan compara `EXPLAIN QUERY
    PLAN` y el tiempo **con y sin un índice temporal**, sobre una copia de la base (nunca la
    versionada). SI el índice mejorara de forma relevante, ENTONCES se replantea esta
    decisión con el usuario antes de implementar.
  - No se modifica la base versionada.
- **RNF-3:** Cero SQL armado concatenando valores de la query: todo valor **de filtro**
  (texto y números) viaja como parámetro (`?`). Se verifica con un test que inspecciona el
  SQL ejecutado (ningún valor de filtro aparece en él y todos están en los parámetros), el
  e2e de inyección y una búsqueda en el código. *Precisión tras la validación (16/11):* el
  driver de SQLite de TypeORM escribe como literal todo parámetro de tipo `number`, así que los
  filtros numéricos se envían como texto con `CAST(? AS INTEGER|REAL)`. `LIMIT` y `OFFSET` los
  escribe siempre el QueryBuilder de TypeORM como literales (no admite parámetros ahí); se
  aceptan porque provienen de enteros ya validados por el DTO (`skip`, `limit`), nunca del
  texto de la URL.
- **RNF-4:** El contrato del TP-5 cubre el endpoint nuevo (éxito y cada código documentado);
  la cobertura sigue ≥ 75/75 y los gates (y `gates` en CI) en verde.
- **RNF-5:** El trabajo entra por la rama `tp-3-busqueda` y un PR (spec 006 RF-9).
- **RNF-6 (consistencia de los metadatos):** la forma `{ items, total, skip, limit, hasMore }`
  se define **una sola vez**, como pieza reutilizable: todo buscador o listado paginado con
  metadatos que se agregue usa exactamente la misma. Los listados existentes no la adoptan
  por compatibilidad (decisión 1): cambiarlos rompería a sus clientes y al contrato.

## Casos límite

| # | Situación | Esperado |
|---|---|---|
| 1 | Sin coincidencias | 200, `items: []`, `total: 0`, `hasMore: false` |
| 2 | `skip` mayor que el total | 200, `items: []`, `total` real, `hasMore: false` |
| 3 | Los 5 filtros a la vez | Solo lo que cumple todos |
| 4 | `sort=campo_hackers` o `order=arriba` | 400 que nombra el parámetro |
| 5 | `q` con `%`, `_`, `'` o acentos | Se buscan literalmente; `%` no es comodín |
| 6 | `q=' OR 1=1 --` u otra inyección | Se busca como texto: normalmente 0 resultados, nunca error ni datos de más |
| 7 | Pista sin género, sin filtro de género | Aparece |
| 8 | `limit=999999` | 400 (tope 100, como los listados) |
| 9 | `skip=-1`, `skip=abc` | 400 |
| 10 | Sin ningún filtro | 200 con la primera página de todas (`total` = 3503 en la base original) |
| 11 | `minPrice=2&maxPrice=1` | 400 |
| 12 | `genreId=999999` | 200, `items: []` |
| 13 | `q` vacío o solo espacios | 400 |
| 14 | `q=HIGHWAY` y `q=highway` | Mismos resultados |
| 15 | Orden con empates (`sort=unitPrice`) | Desempate por `TrackId` ascendente: páginas sin repetidos ni huecos |
| 16 | Con credencial inválida | Se ignora (endpoint público) → 200 |
| 17 | `minPrice=0.99&maxPrice=0.99` | 200 con las pistas de exactamente 0,99 |
| 18 | `genreId=1&genreId=2` | 400 que nombra `genreId` |
| 19 | `skip=99999999999999999999` | 200, `items: []`, `skip: 9007199254740991` en la respuesta |
| 20 | `minPrice=1,5`, `minPrice=1e2`, `minPrice=.5` | 400 que nombra `minPrice` |
| 21 | `sort=name` con nombres en mayúsculas y minúsculas | Orden sin distinguir mayúsculas |

## Fuera de alcance

- Búsqueda full-text, "fuzzy", sugerencias, búsqueda sin acentos.
- Buscadores de otros recursos y metadatos en los listados existentes.
- Índices nuevos y cambios de esquema.

## Criterios de finalización

- Cada RF y cada caso límite con al menos un test automatizado que pasa.
- Evidencia del plan de consulta (RNF-2) en `plan.md` o `validate.md`.
- Gates locales y `gates` del PR en verde; PR mergeado por el usuario.

## Decisiones de la entrevista (16/11)

1. **Contrato:** endpoint nuevo `GET /tracks/search` con `{ items, total, skip, limit,
   hasMore }`; los listados existentes no cambian (no se rompe a sus clientes ni al contrato).
2. **Texto:** en `Name` y `Composer`, sin distinguir mayúsculas (Unicode); los acentos
   distinguen (coherente con la spec 005). Género y artista, como filtros por id.
3. **Sin filtros:** devuelve todo, paginado.
4. **Índices:** se usan los existentes de las claves foráneas; no se toca la base versionada.
5. Por defecto (avisado en la entrevista): los 5 filtros de la tabla; `limit` 1–100 como los
   listados; orden por lista blanca con desempate por id; endpoint público; ids inexistentes
   → 200 vacío; mínimo > máximo → 400.

Correcciones aprobadas tras clarify ronda 1 (A1–A3, K1–K2, C1–C2, T1–T2, R1): `sort=name`
sin distinguir mayúsculas; `skip` informado ya topado; formato estricto de precios;
justificación de índices con evidencia medida y condición para replantear (RNF-2); forma de
metadatos reutilizable (RNF-6); parámetro repetido → 400; mínimo = máximo válido;
verificación de RNF-1/RNF-3 por inspección del SQL y de RF-12 por `/docs-json`.

## Dudas abiertas

- Ninguna.
