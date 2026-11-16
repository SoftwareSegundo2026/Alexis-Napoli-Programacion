# Plan 005 — Suite de calidad: cobertura, TDD y contrato (TP-5)

Estado: **aprobado** (16/11, Alexis Napoli — incluye la carpeta nueva `test/contract/`) · Spec: `specs/005-calidad/spec.md` (aprobada el 16/11, clarify ronda 2)

## Dependencias nuevas

**Ninguna** (RNF-5). Ya están instalados todos los paquetes necesarios:

| Paquete (ya instalado) | Para qué en este TP |
|---|---|
| `@vitest/coverage-v8` | Medir cobertura y aplicar el umbral (RF-1, RF-2) |
| `supertest` | Peticiones HTTP del contrato (RF-3 a RF-5) |
| `better-sqlite3` (vía TypeORM) | Registrar una función SQL propia para el bug 2 (RF-7) |

## Hallazgos del análisis previo (verificados el 16/11)

- **Cobertura e2e "rara" (1548 líneas):** al correr la configuración e2e con `include: src/**`,
  Vitest contó como código los `*.spec.ts` unitarios de `src/` (con 0%). Excluye solo los
  tests de la configuración que está corriendo. Conclusión: el gate excluye los tests
  **explícitamente** y mide solo con los tests unitarios, como dice la spec.
- **Causa del bug 1:** TypeORM escribe el `skip` como número literal en el SQL
  (`OFFSET 100000000000000000000`). SQLite acepta hasta el entero de 64 bits más grande
  (`9223372036854775807`) y por encima responde `datatype mismatch` → 500. Con
  `Number.MAX_SAFE_INTEGER` (`9007199254740991`) responde bien, con 0 filas.
- **Causa del bug 2:** `LOWER()` de SQLite solo convierte A–Z (lo dice un comentario en
  `genres.repository.ts`). TypeORM permite configurar la conexión al abrirla
  (`prepareDatabase`): ahí se puede registrar una función SQL propia escrita en JavaScript.
- **Causa del bug 3:** los opcionales usan `@IsOptional() @Trim() @IsString()`; `@Trim()`
  deja `""` y `@IsOptional()` solo omite la validación para `null`/`undefined`, así que `""`
  pasa y se guarda.

## Estructura (lo nuevo y lo que cambia)

```
vitest.config.ts                      ← bloque coverage: include, exclude, umbral, reportes (T1)
src/
├── common/
│   ├── dto/pagination-query.dto.ts   ← skip/limit enormes: se topan a MAX_SAFE_INTEGER (T4)
│   ├── validation/trim-to-null.decorator.ts   ← NUEVO: recorta y "" → null (T6)
│   └── patch/assign-defined.ts       ← NUEVO: aplica solo los campos que vinieron (T7)
├── database/
│   ├── database.module.ts            ← prepareDatabase: registerSqlFunctions (T5)
│   └── sql-functions.ts              ← NUEVO: función SQL unicode_lower (T5)
├── artists/, genres/                 ← existsWithName usa unicode_lower (T5)
├── artists/, albums/, tracks/ dto    ← opcionales de texto con @TrimToNull (T6)
├── users/dto/create-user.dto.ts      ← full_name con @TrimToNull (T6)
└── */*.service.ts (4 del catálogo)   ← update() usa assignDefined (T7)
test/
└── contract/                         ← NUEVA carpeta (pide aprobación: AGENTS.md)
    ├── shapes.ts                     ← formas esperadas escritas a mano + verificador
    ├── catalog.cases.ts              ← casos de artistas, géneros, álbumes y pistas
    ├── users.cases.ts                ← casos de login y usuarios
    └── contract.e2e-spec.ts          ← corre todos los casos + inventario contra /docs-json
```

## Decisiones (y por qué), contra la constitution

### Gate de cobertura (RF-1, RF-2) — T1

- Configuración en `vitest.config.ts` (bloque `coverage`), usado por `pnpm test:cov` sin
  cambiar el script: `provider: 'v8'`, `include: ['src/**/*.ts']`, `exclude:
  ['src/**/*.spec.ts']`, `thresholds: { lines: 75, branches: 75 }`, reportes
  `text-summary` y `json-summary`.
- **Por qué `include` explícito:** sin él, Vitest solo cuenta los archivos que algún test
  importa (el 89% engañoso). Con él, un archivo sin tests cuenta con 0% (caso 2).
- **Por qué `exclude` explícito:** es lo que explica el número raro de la cobertura e2e;
  no se depende de un comportamiento implícito.
- **Por qué `json-summary`:** deja en `coverage/coverage-summary.json` las cantidades
  (total y cubiertas) de líneas y ramas. Con eso se calcula "sin cubrir" en cada tarea
  (RNF-1) sin contar a ojo. `coverage/` ya está en `.gitignore`.
- Vitest termina con error si no se alcanza un umbral, y también si falla un test (RF-1,
  caso 18): no hace falta código propio.

### Contrato (RF-3 a RF-5) — T2 y T3

- **Herramienta:** Vitest + supertest dentro de `pnpm test:e2e` (decisión 5 de la spec):
  misma app en memoria y misma base temporal por archivo que el resto de los e2e (RNF-2).
- **Un caso = una fila de datos**, no un `it` escrito a mano: `{ operation: 'POST
  /api/v1/artists', status: 201, name: 'alta válida', request: (api) => …, shape }`. Un solo
  `it.each` los recorre. El nombre del test es `operación · código · caso`, así el mensaje
  de falla nombra la operación (RF-3).
- **Formas escritas a mano** en `shapes.ts` desde las specs 001 y 002 (RF-5, A4): cada
  campo con sus tipos admitidos, p. ej. `Artist = { ArtistId: ['number'], Name:
  ['string'], ImageUrl: ['string', 'null'] }`. El verificador compara el conjunto **exacto**
  de claves y el tipo de cada valor; los listados verifican **cada** elemento. Error =
  exactamente `{ detail: ['string'] }`. 204 = cuerpo vacío.
- **Inventario (RF-4):** el contrato lee `/docs-json` y arma la lista de pares
  (operación, código documentado). Falla si a un par le falta un caso, y también si un caso
  apunta a un par que la documentación ya no declara (contrato desactualizado). Mismo
  patrón que `protection.e2e` del TP-2.
- **Estado entre casos:** los casos que borran o modifican crean antes su propio recurso
  (un artista nuevo, etc.), para no depender del orden ni de datos de otros casos.
- **Por qué dos tareas:** el inventario solo puede pasar cuando están las 25 operaciones.
  T2 deja la infraestructura y el catálogo (20 operaciones); T3 agrega login y usuarios
  (5) y recién ahí activa el inventario. Así ninguna tarea cierra con un gate en rojo.

### Bug 1 — `skip` enorme (RF-6) — T4

- Arreglo en `toStrictInteger` (`pagination-query.dto.ts`): un texto de solo dígitos se
  convierte a número y **se topa en `Number.MAX_SAFE_INTEGER`**. Un texto de 400 dígitos
  daba `Infinity` (→ 400) y ahora también se topa.
- **Por qué topar y no rechazar:** ninguna tabla puede tener 9 mil billones de filas, así
  que `skip = MAX_SAFE_INTEGER` devuelve lo mismo que `skip = 10^400`: `[]`. El resultado
  es idéntico para el cliente y SQLite nunca recibe un número que no entiende.
- Negativos, decimales y no numéricos siguen dando 400 (no cambia la expresión regular que
  decide qué es un entero). Para `limit`, un número enorme topado sigue superando
  `@Max(100)` → 400 (caso 8).
- Se arregla en el DTO (la capa que convierte la entrada) y vale para los 5 listados,
  incluido el de usuarios, que usa el mismo DTO.

### Bug 2 — mayúsculas no ASCII (RF-7) — T5

- Se registra en la conexión una función SQL **propia**, `unicode_lower(texto)`, que
  ejecuta el `toLowerCase()` de JavaScript (Unicode, sin configuración regional: A2). Se
  registra en `prepareDatabase` de TypeORM, que corre cada vez que se abre la conexión.
- `existsWithName` de artistas y géneros pasa a comparar `unicode_lower(TRIM(name)) =
  :name`, con `:name` ya recortado y en minúsculas desde JavaScript.
- **Alternativas descartadas:**
  - *Traer todos los nombres y comparar en JavaScript:* funciona, pero lee la tabla
    entera en cada alta o modificación. La función SQL deja la comparación en la base.
  - *Extensión ICU de SQLite:* exige compilar o distribuir una extensión nativa. Es una
    dependencia nueva y frágil en Windows.
- La función es **determinística** (mismo texto → mismo resultado). Se declara así al
  registrarla, por si en el futuro se la usa en un índice.
- La comparación de `email` de usuarios queda como está: hallazgo anotado, fuera de alcance.

### Bug 3 — opcional vacío (RF-8) — T6

- Decorador nuevo `@TrimToNull()`: recorta y, si queda `""`, devuelve `null`. Reemplaza a
  `@Trim()` **solo en los opcionales de texto** (`ImageUrl` de artista y de álbum en alta y
  modificación, `Composer` en alta y modificación, `full_name` en el alta de usuario).
- **Por qué un decorador nuevo y no cambiar `@Trim()`:** en los obligatorios, `""` tiene
  que seguir fallando con 400 (`@IsNotEmpty`, caso 15). Si `@Trim()` devolviera `null`, el
  error cambiaría de mensaje.
- El `null` resultante ya está soportado: `@IsOptional()` lo deja pasar y los services ya
  lo guardan (es lo que pasa hoy al enviar `null`). No cambian los services.

### Refactor del PATCH (RF-9) — T7

- Función `assignDefined(target, changes)`: copia a la entidad solo las claves de
  `changes` cuyo valor no es `undefined`. Cada service arma el objeto `changes` con los
  nombres de la entidad (`{ name: dto.Name, albumId: dto.AlbumId, … }`), que traduce de
  PascalCase a camelCase y queda tipado sin `any` (`Partial<Entidad>`).
- Las verificaciones previas no se mueven: la existencia de ids (álbumes, pistas) y el
  nombre libre (artistas, géneros) se siguen comprobando **antes** de asignar.
- **El commit de T7 no toca ningún archivo de test** (ni agrega uno). `assignDefined` queda
  cubierto por los tests de los 4 services que ya existen: si no lo cubrieran, aumentarían
  las líneas sin cubrir y el criterio de RF-9 lo detectaría.

### Contra la constitution

- Principio 1: cada cambio de comportamiento está en la spec (RF-6 a RF-8, RF-10).
- Principio 2: ninguna tarea se marca `[x]` en rojo. Los commits `(rojo)` de T4–T6 no
  marcan `[x]` (excepción declarada en RNF-4).
- Principio 3: el tope de `skip` y `@TrimToNull` están en DTOs; la función SQL, en la capa
  de base de datos; `assignDefined` la usan los services; los controllers no cambian.
- Principio 4: sin `any`. Las respuestas de supertest se leen como `unknown` y se validan
  con el verificador de formas. La función SQL recibe `unknown` y devuelve igual lo que no
  es texto.
- Principio 6: identificadores en inglés, comentarios y mensajes en español.

## Estrategia de tests

| Tarea | Rojo primero | Tipo |
|---|---|---|
| T1 | Mutación: subir el umbral por encima del valor real → `test:cov` falla; un test roto → falla | Gate (documentado en MEMORY y `validate.md`) |
| T2–T3 | Mutación: quitar un campo de un DTO de respuesta, devolver `UnitPrice` como texto, cambiar un 201 por 200 → el contrato falla nombrando la operación | e2e |
| T4 | `skip` de 20 y de 400 dígitos en el DTO (unit) y en los 5 listados (e2e) | unit + e2e |
| T5 | `CANCIÓN ÑANDÚ` / `canción ñandú` / `BJÖRK` → 409; `Cancion` frente a `Canción` → 201; `STRASSE` frente a `Straße` → 201 | e2e (rojo) + unit de `unicode_lower` |
| T6 | `ImageUrl`, `Composer` y `full_name` con `""` y `"   "` → `null`; obligatorio con espacios → 400 | unit (DTO vía pipe) + e2e |
| T7 | Sin tests nuevos: los existentes son la red; se comparan líneas y ramas sin cubrir antes y después | — |

- **T4–T6 en dos commits** (RNF-4): `005-Tn (rojo)` con los tests nuevos fallando de verdad
  (se guarda la salida); `005-Tn` con el arreglo, sin tocar esos tests.
- **El rojo tiene que fallar por el bug, no por compilar.** Los tests del rojo usan solo
  lo que ya existe (el pipe, los DTOs, la API). En T5 la prueba unitaria de
  `unicode_lower` importa un archivo nuevo, así que va en el commit del arreglo; el rojo
  de T5 son los e2e.
- **Cobertura por tarea:** al cerrar cada tarea se registran porcentajes y cantidades sin
  cubrir (de `coverage-summary.json`) en `MEMORY.md`. Línea de base: la que mida T1.

## Riesgos y casos a tener presentes

- **Que una base nueva no tenga la función SQL:** si algo abre una conexión sin
  `prepareDatabase`, `unicode_lower` no existe y la consulta falla con 500. La app tiene una
  sola configuración (`DatabaseModule`); el test de `UsersRepository` arma su propia
  conexión, pero no usa artistas ni géneros. Se verifica en T5 con la app real.
- **El umbral queda justo** (76,5% contra 75%): T2–T3 no cambian la cobertura unitaria
  (son e2e) y T4–T6 agregan tests unitarios, así que no debería bajar. Se mide en cada tarea.
- **El contrato es largo** (~100 casos): se mantiene legible con tablas de datos y formas
  reutilizadas. Si una operación documenta un código imposible de provocar, se revisa la
  documentación antes de dejar el par sin caso.
- **Prettier y lint** solo sobre archivos propios; `pnpm exec tsc --noEmit -p
  tsconfig.json` también chequea `test/contract/`.

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

1. **T1** — Gate de cobertura (configuración + demostración por mutación + línea de base).
2. **T2** — Contrato: infraestructura, formas y casos del catálogo (20 operaciones).
3. **T3** — Contrato: login y usuarios (5 operaciones) + inventario contra `/docs-json`.
4. **T4** — Bug 1, `skip` enorme (rojo → arreglo).
5. **T5** — Bug 2, mayúsculas no ASCII (rojo → arreglo).
6. **T6** — Bug 3, opcional vacío → `null` (rojo → arreglo).
7. **T7** — Refactor del PATCH con red de seguridad.
