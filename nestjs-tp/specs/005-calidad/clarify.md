# Clarify 005 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 005-calidad`).
> Revisión contra `spec.md` (borrador aprobado del 16/11), `docs/constitution.md`,
> `rubrica/rubrica-entrega.md` y el alcance de `consignas/TP5-suite-calidad.md`.

## Ronda 1 — 16/11

### Alcance obligatorio de la consigna

| # consigna | Exigencia | ¿Está en la spec? |
|---|---|---|
| 1 | Spec con RF de cobertura ("SI baja de X%, el gate falla") | Sí: RF-1 |
| 1 | Spec con RF de contrato ("CUANDO un endpoint cambia, el contrato lo detecta") | Sí: RF-3 |
| 2 | `pnpm test:cov` con umbral declarado que interrumpe el proceso | Sí: RF-1, RF-2 |
| 3 | TDD sobre 3 bugs reales, con nota en `MEMORY.md` | Sí: RF-6 a RF-8 + RNF-4 (la nota en `MEMORY.md` no está escrita en la spec, ver R2) |
| 4 | Refactor con cobertura que no baja y tests sin tocar | Sí: RF-9 |
| 5 | Contrato ejecutable desde CI: éxito + errores de cada endpoint | Sí: RF-4, RF-5, RNF-2 |
| 6 | Suite en verde con los 4 gates | Sí: criterios de finalización |
| criterio | Umbral declarado en la constitution o en la spec | Sí: RF-1 |
| criterio | Ninguna tarea bajó la cobertura | Sí: RNF-1 |

Detecciones adicionales:

### 1. Ambigüedades

- **A1.** RF-6 dice "un `skip` entero de **cualquier** tamaño → 200". Un texto de cientos
  de dígitos se convierte en `Infinity` en JavaScript, y hoy da 400 (verificado:
  `Number("9".repeat(400))` → `Infinity`). La spec no define dónde termina "cualquier
  tamaño" ni qué responde por encima de ese límite.
- **A2.** RF-7 dice "sin distinguir mayúsculas en ninguna letra", pero no fija **qué
  regla** de mayúsculas/minúsculas se usa. Hay letras sin equivalente uno a uno (`ß`
  frente a `SS`, la `İ` turca), y el resultado puede depender de la configuración
  regional del servidor.
- **A3.** RF-9 y RNF-1 exigen que la cobertura "no baje", pero no dicen **qué se
  compara**: ¿el porcentaje, con cuántos decimales? Un refactor que **elimina código
  duplicado y cubierto** baja el porcentaje de líneas cubiertas aunque no deje nada
  nuevo sin probar: con la regla tal como está, el refactor pedido por la consigna
  podría incumplirla.
- **A4.** RF-5 pide verificar el "tipo de cada campo", pero no dice **contra qué
  referencia**. Si el contrato toma la forma esperada de la documentación que genera
  la propia aplicación (Swagger), un cambio en el código que también cambie la
  documentación se "autoaprueba" y RF-3 no se cumple.

### 2. Contradicciones

- **K1.** RNF-4 pide, para cada bug, un commit con el test en rojo seguido de otro
  commit con el arreglo. Eso choca con:
  - la constitución (principio 2: ninguna tarea se da por hecha con un gate en rojo),
    porque el commit intermedio deja `pnpm test` en rojo en el historial;
  - la rúbrica ("un commit por tarea"; −10 por tarea `[x]` con un gate en rojo).
- **K2.** RF-8 dice que la regla vale "en un alta o una modificación" para `full_name`,
  pero la spec 002 no permite modificar `full_name` (`PATCH /users/{id}` solo acepta
  `disabled` e `is_admin`).

### 3. Casos límite no cubiertos

- **C1.** RF-8 no dice qué responde un PATCH que manda `ImageUrl: "  "` a un recurso que
  **ya** tiene `ImageUrl: null`: ¿cuenta como cambio? Para usuarios, la spec 002 dice que
  un PATCH sin cambio real no toca la base. Para el catálogo no se define (la respuesta
  es la misma, pero el criterio del refactor del PATCH depende de esto).
- **C2.** RF-4 no define qué pasa con los códigos de error que una operación **puede**
  devolver pero no documenta, por ejemplo el 400 por JSON mal formado en `POST /genres`.
  Tampoco si el contrato debe detectar que la documentación omite un código.
- **C3.** RF-1 no dice qué pasa si `pnpm test:cov` corre con **tests en rojo** (¿falla
  por los tests, por la cobertura o por las dos cosas?). Tampoco si el gate de
  cobertura se suma a los 4 gates de cada tarea.

### 4. Conflictos con la constitution / reglas no comprobables

- **T1.** Los criterios de finalización exigen "cada RF y cada caso límite con al menos
  un test automatizado", pero los casos 1, 3, 4, 5, 6 y 16 (el gate falla al bajar la
  cobertura; el contrato detecta un cambio; el refactor no tocó tests) **no se pueden
  probar con un test automatizado** de la propia suite: se demuestran rompiendo algo a
  propósito (mutación) o mirando el historial.
- **T2.** El principio 1 de la constitución ("nada se implementa si no está en la spec
  activa") exige que un cambio de comportamiento pase por `/sdd-change`. RF-6 a RF-8
  **cambian el comportamiento** definido por las specs 001 y 002 (RF-8 en especial: hoy
  `""` se guarda tal cual). La spec 005 no declara explícitamente que modifica esas specs
  ni qué reglas reemplaza (la 002 sí lo hizo con su RF-12).
- Principio 4 (TypeScript estricto) y principio 5 (seguridad): sin conflictos. El
  contrato va a necesitar credenciales de prueba: ya existen (`test/helpers/auth.ts`,
  RNF-3 de la 002).

### 5. RF sin criterio de aceptación / dudas abiertas

- **R1.** HU-6 no tiene línea de *Aceptación* como las demás historias.
- **R2.** La consigna exige "cada bug con su nota en `MEMORY.md`"; la spec no lo pide
  (RNF-4 solo habla del historial de commits).

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A4, K1–K2, C1–C3, T1–T2, R1–R2)

## Ronda 2 — 16/11

Revisión de la spec corregida (resoluciones aprobadas por el usuario; K1 elegida por él:
dos commits con rojo real).

| Detección | Dónde quedó resuelta | Estado |
|---|---|---|
| A1 | RF-6: solo dígitos, cualquier cantidad → 200; nunca 400/500 por tamaño; caso 17 | Resuelta |
| A2 | RF-7: minúsculas de Unicode sin configuración regional; `ß` ≠ `SS`; caso 19 | Resuelta |
| A3 | RF-9 y RNF-1: se comparan líneas y ramas **sin cubrir**; el porcentaje nunca bajo el umbral | Resuelta |
| A4 | RF-5: formas escritas a mano desde las specs; la documentación solo como inventario | Resuelta |
| K1 | RNF-4: dos commits por bug (`(rojo)` sin `[x]` + arreglo sin tocar el test), excepción declarada | Resuelta |
| K2 | RF-8: `full_name` solo en el alta | Resuelta |
| C1 | RF-8: vacío o solo espacios = exactamente igual que `null` | Resuelta |
| C2 | RF-4: solo los códigos documentados; lo no documentado ya está cubierto | Resuelta |
| C3 | RF-1 (tests en rojo → falla; caso 18) y RNF-1 (`test:cov` como 5.º gate) | Resuelta |
| T1 | Criterios de finalización: test automatizado o mutación/historial documentado en `validate.md` | Resuelta |
| T2 | RF-10: qué reglas de 001 y 002 se precisan | Resuelta |
| R1 | HU-6 con aceptación (todas las HU tienen una) | Resuelta |
| R2 | RNF-4: nota por bug en `MEMORY.md` | Resuelta |

Verificaciones de la ronda 2:

- Los cambios no abren contradicciones nuevas: el commit `(rojo)` no marca `[x]`, así que
  no cae en la penalidad "tarea `[x]` con gate en rojo" ni en el principio 2 de la
  constitución (la tarea no se da por hecha en ese commit).
- RF-6 sigue respetando la spec 001: `skip` negativo, con decimales o no numérico → 400
  (solo cambia el tamaño admitido); el caso 8 lo confirma para `limit`.
- Cada RF tiene caso límite o criterio que lo verifica; cada caso límite es comprobable
  por test o por mutación documentada.

**VEREDICTO: APROBADA**
