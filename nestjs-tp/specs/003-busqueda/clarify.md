# Clarify 003 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 003-busqueda`).
> Revisión contra `spec.md` (aprobada el 16/11), `docs/constitution.md`, las specs 001, 002,
> 005 y 006 y `consignas/TP3-motor-busqueda.md`.

## Ronda 1 — 16/11

### Decisiones y casos obligatorios de la consigna

| Exigencia de la consigna | ¿Está en la spec? |
|---|---|
| Filtro sin coincidencias: 200 + lista vacía ≠ 404 | Sí: RF-7, casos 1 y 12 |
| `limit=999999`: tope o "sin tope" explícito | Sí: tabla de parámetros, caso 8 |
| `sort` fuera de la whitelist → 400 | Sí: RF-5, caso 4 |
| `skip` negativo o no numérico → 400 antes del repository | Sí: RF-9, caso 9 |
| `%`, `_`, `'`, acentos: parametrizado | Sí: RF-8, RNF-3, caso 5 |
| Sin filtros: ¿todo o al menos uno? | Sí: RF-1, caso 10 |
| Casos con test: sin coincidencias, `skip` > total, 5 filtros, orden inválido, inyección, relación vacía | Sí: casos 1, 2, 3, 4, 6, 7 |
| Metadatos `total`, `skip`, `limit`, `hasMore` | Sí: RF-6 |
| Paginación en la base e índices con evidencia | Parcial: ver K1 y T1 |
| Documentación de todos los query params | Sí: RF-12 (sin verificación, ver R1) |

Detecciones adicionales:

### 1. Ambigüedades

- **A1.** RF-5 permite `sort=name`, pero no dice **cómo** se comparan los nombres. El orden
  por defecto de SQLite es por bytes: todas las mayúsculas van antes que las minúsculas y las
  letras acentuadas después de la `z` ("Zeppelin" antes que "abc", "Ñandú" al final).
- **A2.** RF-6 dice que `skip` en la respuesta es "el aplicado". Desde la spec 005, un `skip`
  enorme se topa en `Number.MAX_SAFE_INTEGER`: con `skip=99999999999999999999` la respuesta
  devolvería otro número. No se define si eso es lo esperado.
- **A3.** La tabla de parámetros fija las reglas de los precios ("número ≥ 0 con hasta 2
  decimales") pero no el **formato de texto** que se acepta en la URL (`1.5`, `1,5`, `1e2`,
  `.5`, `+1`).

### 2. Contradicciones

- **K1.** La consigna pide "índices sobre los campos filtrados", y la decisión 4 no agrega
  ninguno. RNF-2 solo justifica género y artista; **texto, precio y duración** quedan sin
  índice y sin justificación escrita en la spec (el criterio de evaluación exige que las
  decisiones estén justificadas en la spec, no en el código).
- **K2.** La consigna evalúa que "los metadatos de paginación sean consistentes en todos los
  recursos", pero la decisión 1 deja los listados sin metadatos. La spec no explica cómo se
  lee ese criterio con un solo buscador.

### 3. Casos límite no cubiertos

- **C1.** Un parámetro **repetido** (`genreId=1&genreId=2`): Express lo entrega como lista. No
  se define si es 400, si se toma uno o si se combinan.
- **C2.** `minPrice` igual a `maxPrice` (rango de un solo valor) no tiene caso; RF-9 solo
  cubre mínimo **mayor** que máximo.

### 4. Conflictos con la constitution / reglas no comprobables

- **T1.** RNF-1 ("nunca se cargan todas las pistas en memoria") no dice cómo se verifica: un
  test de la respuesta no distingue si se paginó en la base o en memoria.
- **T2.** RNF-3 ("cero concatenación") no tiene método de verificación más allá del caso 6.

### 5. RF sin criterio de aceptación / dudas abiertas

- **R1.** RF-12 (documentación de cada parámetro) no tiene caso ni test: el inventario del
  contrato del TP-5 verifica códigos, no parámetros.

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A3, K1–K2, C1–C2, T1–T2, R1)

## Ronda 2 — 16/11

Revisión de la spec corregida (resoluciones aprobadas por el usuario).

| Detección | Dónde quedó resuelta | Estado |
|---|---|---|
| A1 | RF-5: `sort=name` con `unicode_lower`; limitación de acentos documentada; caso 21 | Resuelta |
| A2 | RF-6: `skip` aplicado (topado); caso 19 | Resuelta |
| A3 | Tabla de parámetros: formato `123` / `123.45`; caso 20 | Resuelta |
| K1 | RNF-2: justificación por tipo de filtro, evidencia medida en el plan y condición para replantear | Resuelta |
| K2 | RNF-6: forma única y reutilizable; listados sin cambios por compatibilidad | Resuelta |
| C1 | Tabla de parámetros y RF-9: valor repetido → 400; caso 18 | Resuelta |
| C2 | RF-9: mínimo = máximo válido; caso 17 | Resuelta |
| T1 | RNF-1: inspección del SQL generado | Resuelta |
| T2 | RNF-3: SQL sin el texto de `q`, e2e de inyección, búsqueda en el código | Resuelta |
| R1 | RF-12: test sobre `/docs-json` | Resuelta |

Verificaciones de la ronda 2: sin contradicciones nuevas con las specs 001, 002, 005 y 006 (el
tope de `skip` y la regla de `unicode_lower` se reutilizan tal cual); cada RF tiene caso o
método de verificación; la condición de RNF-2 obliga a volver al usuario si la medición
contradice la decisión 4, en vez de cambiarla en silencio.

**VEREDICTO: APROBADA**
