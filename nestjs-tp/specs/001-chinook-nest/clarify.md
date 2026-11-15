# Clarify 001 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 001-chinook-nest`).
> Revisión contra `spec.md` (borrador del 15/11) y `docs/constitution.md`.

## Ronda 1 — 15/11

### 1. Ambigüedades

- **A1.** RF-13: no dice qué pasa si se "renombra" un artista o género **a su mismo
  nombre actual** (por ejemplo, un PATCH que reenvía el `Name` sin cambios). Leído
  literal, el nombre "ya existe" y correspondería 409.
- **A2.** Reglas de datos: "texto no vacío" no aclara si un texto compuesto **solo
  por espacios** cuenta como vacío.
- **A3.** Reglas de datos: "debe existir" (`ArtistId`, `MediaTypeId`, `AlbumId`,
  `GenreId`) aparece en la columna junto a "en el alta"; no queda claro si la
  existencia también se exige en una **modificación**.
- **A4.** Contrato: no se define el **tipo JSON de `UnitPrice` en la respuesta**
  (número o texto) ni si en la entrada se acepta como texto (`"0.99"`).
- **A5.** No se define la **precedencia de errores** cuando una escritura tiene a la
  vez clave inválida y cuerpo inválido (¿401 o 400?), o clave inválida e id
  inexistente (¿401 o 404?).

### 2. Contradicciones

- Ninguna entre requisitos ni contra la constitution.

### 3. Casos límite no cubiertos

- **C1.** Cuerpo que **no es JSON válido** (JSON malformado) en un alta o modificación.
- **C2.** Id entero **negativo o cero** en la ruta (`/albums/-1`, `/albums/0`).

### 4. Conflictos con la constitution

- Ninguno. RF-11 y RNF-3 cubren el principio 5 (escritura protegida, secretos fuera
  del repo); RF-9 y el contrato cubren el principio 3 (entrada y salida por DTOs).

### 5. RF sin criterio de aceptación / dudas abiertas

- Todos los RF están referenciados desde alguna HU con criterio de aceptación.
- No quedan `[NECESITA ACLARACIÓN]`.

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A5, C1–C2)

## Ronda 2 — 15/11

El usuario aprobó las resoluciones propuestas y se incorporaron a `spec.md`:

| Detección | Dónde quedó resuelta |
|---|---|
| A1 | RF-13 ("otro registro"; el nombre propio no es conflicto) + caso límite |
| A2 | Tabla de reglas, fila "Todos" + caso límite |
| A3 | Tabla de reglas, fila "Todos" + caso límite |
| A4 | Contrato general (`UnitPrice` numérico) |
| A5 | Contrato general (prioridad 401 → 400 → 404 → 409) + caso límite |
| C1 | RF-10 + caso límite |
| C2 | Caso límite (id ≤ 0 → 404) |

Sin nuevas ambigüedades, contradicciones ni conflictos con la constitution.

**VEREDICTO: APROBADA**
