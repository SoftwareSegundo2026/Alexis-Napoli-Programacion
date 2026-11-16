VEREDICTO: APROBADO

# Validación 005 — Suite de calidad: cobertura, TDD y contrato (TP-5)

Fecha: 16/11/2026 · Rol: reviewer (solo lectura: no se modificó código durante la validación)
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `docs/constitution.md`,
`consignas/TP5-suite-calidad.md`, `git log`.

## Gates (ejecutados en esta validación)

| Gate | Comando | Resultado |
|---|---|---|
| Lint | `pnpm lint` | ✅ exit 0, 0 avisos |
| Build | `pnpm build` | ✅ exit 0 |
| Unit | `pnpm test` | ✅ 279/279 (31 archivos) |
| e2e | `pnpm test:e2e` | ✅ 380/380 (17 archivos) |
| Cobertura | `pnpm test:cov` | ✅ exit 0 — líneas 76,88% (479/623), ramas 81,77% (193/236); umbral 75/75 |
| Tipos (extra) | `pnpm exec tsc --noEmit -p tsconfig.json` | ✅ exit 0 (incluye `test/`) |

Sin tests omitidos (`skip`/`only`/`todo`), sin `any`, `@ts-ignore` ni `@ts-expect-error` en `src/`
ni `test/` (búsqueda en esta validación).

Mutación repetida en esta validación (sin tocar código): `pnpm test:cov
--coverage.thresholds.lines=77` → los 279 tests pasan y el proceso sale con **código 1**:
"Coverage for lines (76.88%) does not meet global threshold (77%)".

## Requisitos → tests o mutación → resultado

| RF | Qué exige | Evidencia | Resultado |
|---|---|---|---|
| RF-1 | `test:cov` falla si líneas o ramas < 75%, o si falla un test | Configuración en `vitest.config.ts` (`thresholds: { lines: 75, branches: 75 }`). Mutaciones (005-T1): umbral de líneas 80 y de ramas 81 con 246 tests verdes → código 1; test roto temporal → código 1. Repetida acá con 77 → código 1 | ✅ |
| RF-2 | Medición sobre TODO `src/`, excluyendo solo los tests; mismos valores en spec y configuración | `include: ['src/**/*.ts']`, `exclude: ['src/**/*.spec.ts']`; `main.ts` y `artists.controller.ts` (sin test unitario) figuran con 0%; ningún `.spec.ts` figura (005-T1) | ✅ |
| RF-3 | Un cambio de respuesta hace fallar el contrato y nombra la operación | `test/contract/contract.e2e-spec.ts` (`it.each` con nombre `operación · código · caso`). Mutaciones (005-T2): sin `ImageUrl` en artista → 4 casos "falta el campo ImageUrl"; `UnitPrice` como texto → 4 casos "se esperaba number y llegó string"; `POST /genres` con 200 → "se esperaba 201 y llegó 200" | ✅ |
| RF-4 | Todas las operaciones documentadas, éxito + cada código documentado; operación sin casos → falla | 104 casos (`catalog.cases.ts` 85, `users.cases.ts` 19) + inventario contra `/docs-json` (faltantes y casos huérfanos). Mutaciones (005-T3): `@ApiNotFound` en `POST /genres` → falla "POST /api/v1/genres · 404"; sin los casos de usuarios → lista los 19 pares | ✅ |
| RF-5 | Código, conjunto EXACTO de campos y tipos; error = `{"detail"}`; formas escritas a mano | `test/contract/shapes.ts` (formas desde las specs 001 y 002, `checkResponse`); la documentación solo se usa como inventario | ✅ |
| RF-6 | `skip` de cualquier cantidad de dígitos → 200 (`[]` si supera el total) | `pagination-query.dto.spec` (20 y 400 dígitos; `limit` enorme → 400) · `pagination-limits.e2e-spec` (5 listados, 400 dígitos, caso 8) | ✅ |
| RF-7 | Duplicado sin distinguir mayúsculas en ninguna letra → 409; acentos y `ß`/`SS` distinguen | `unicode-names.e2e-spec` (4 altas y 2 modificaciones → 409, incluido el artista real "ANTÔNIO CARLOS JOBIM"; `Cancion`/`Canción` y `STRASSE`/`Straße` → 201) · `sql-functions.spec` (unitario y contra SQLite real) · app real: "CANCIÓN ÑANDÚ" tras "Canción Ñandú" → 409 | ✅ |
| RF-8 | Opcional vacío o de espacios = `null` (7 campos; `full_name` solo en el alta) | `optional-text-fields.spec` (7 campos × `""`/`"   "`, recorte normal y obligatorio → 400) · `optional-empty-text.e2e-spec` (relee lo guardado) | ✅ |
| RF-9 | Refactor del PATCH: tests sin modificar, en verde, sin cubrir no aumenta | `0f0293b`: `git show --stat` sin archivos de test; 279 + 380 en verde; sin cubrir líneas 146 → 144, ramas 49 → 43 | ✅ |
| RF-10 | Declara qué reglas de 001/002 se precisan | Texto de la spec (RF-6 a RF-8 precisan casos y reglas de 001/002); los tests de esas specs siguen pasando sin cambios | ✅ |

## Requisitos no funcionales

| RNF | Evidencia | Resultado |
|---|---|---|
| RNF-1 — ninguna tarea aumenta lo sin cubrir; 5.º gate | Líneas/ramas sin cubrir por tarea (MEMORY.md): T1 146/49 · T2 146/49 · T3 146/49 · T4 146/49 · T5 146/49 · T6 146/49 · T7 **144/43**. Porcentajes siempre ≥ 75 | ✅ |
| RNF-2 — contrato con un comando en máquina limpia | Corre dentro de `pnpm test:e2e`, con la app en memoria y una copia temporal de la base versionada; sin servicios externos | ✅ |
| RNF-3 — ningún test borrado ni debilitado | Los commits del TP-5 solo agregan archivos de test o tests nuevos en archivos existentes (`pagination-query.dto.spec`); ninguno se modificó ni borró | ✅ |
| RNF-4 — evidencia TDD en el historial | Ver tabla "Historial TDD" abajo; nota por bug en `MEMORY.md` (síntoma, causa, arreglo, commits) | ✅ |
| RNF-5 — sin dependencias nuevas | `package.json` sin cambios en el TP-5 | ✅ |

## Historial TDD (verificado con `git show --name-only` en esta validación)

| Bug | Commit rojo (solo tests) | Commit del arreglo | ¿Toca los tests del rojo? |
|---|---|---|---|
| 1 — `skip` enorme → 500 | `1c9e6c3`: 2 tests, 0 código. Falla 2 unit + 6 e2e (500 y 400 en vez de 200) | `0a9a222`: 1 archivo de código | No |
| 2 — duplicados no ASCII | `e485fe1`: 1 test, 0 código. Falla 6 e2e (201/200 en vez de 409) | `e1426a8`: 4 de código + `sql-functions.spec` NUEVO | No |
| 3 — opcional vacío → `""` | `900e74d`: 2 tests, 0 código. Falla 14 unit + 4 e2e ("expected '' to be null") | `f4ac4d2`: 8 de código | No |

En cada commit rojo fallaron SOLO los tests nuevos; los existentes siguieron pasando.

## Casos límite

| # | Situación | Evidencia | Resultado |
|---|---|---|---|
| 1 | Cobertura bajo el umbral con tests verdes → falla | Mutación (T1 y esta validación) | ✅ |
| 2 | Archivo sin tests cuenta con 0% | `main.ts`, `artists.controller.ts` en el reporte (T1) | ✅ |
| 3 | Campo quitado o agregado → contrato falla | Mutación `ImageUrl` (T2); el verificador rechaza campos no declarados | ✅ |
| 4 | Número como texto → falla | Mutación `UnitPrice` (T2) | ✅ |
| 5 | Cambio de código de éxito → falla | Mutación `POST /genres` 200 (T2) | ✅ |
| 6 | Operación documentada sin casos → falla | Mutaciones del inventario (T3) | ✅ |
| 7 | `skip` de 20 dígitos en los 5 listados → 200 `[]` | `pagination-limits.e2e-spec` | ✅ |
| 8 | `skip` enorme + `limit` inválido → 400 por `limit` | `pagination-limits.e2e-spec`, `pagination-query.dto.spec` | ✅ |
| 9 | Alta con mayúsculas no ASCII → 409 | `unicode-names.e2e-spec` › alta | ✅ |
| 10 | Modificación al nombre de otro → 409 | `unicode-names.e2e-spec` › modificación | ✅ |
| 11 | `Cancion` frente a `Canción` → 201 | `unicode-names.e2e-spec`, `sql-functions.spec` | ✅ |
| 12 | `ImageUrl` `""` / `"   "` → `null` | `optional-text-fields.spec`, `optional-empty-text.e2e-spec` | ✅ |
| 13 | PATCH de pista con `Composer` `"  "` → `null` | ídem | ✅ |
| 14 | `full_name` `"   "` → `null` | ídem | ✅ |
| 15 | Obligatorio de solo espacios → 400 | ídem | ✅ |
| 16 | Refactor sin tocar tests, sin cubrir ≤ previo | `0f0293b` (ver RF-9) | ✅ |
| 17 | `skip` de 400 dígitos → 200 `[]` | `pagination-limits.e2e-spec`, `pagination-query.dto.spec` | ✅ |
| 18 | Test roto con cobertura alta → falla | Mutación (T1) | ✅ |
| 19 | `STRASSE` frente a `Straße` → 201 | `unicode-names.e2e-spec`, `sql-functions.spec` | ✅ |

## Criterios de finalización y consigna

- Umbral declarado **en la spec** (RF-1), igual al de la configuración. ✅
- Los 3 bugs con test rojo antes del arreglo, verificable con `git log -p`. ✅
- Ninguna tarea bajó la cobertura (RNF-1). ✅
- Contrato ejecutable con un comando (`pnpm test:e2e`). ✅
- 5 gates en verde. ✅

## Proceso

Fases aprobadas en orden por el usuario, con commit de cada una: spec + clarify (`004db2f`;
clarify ronda 1 CAMBIOS NECESARIOS con 13 detecciones, ronda 2 APROBADA) → plan y tareas
(`13adfee`) → T1 `2d1c75f` · T2 `f874b0c` · T3 `881e421` · T4 `1c9e6c3`+`0a9a222` · T5
`e485fe1`+`e1426a8` · T6 `900e74d`+`f4ac4d2` · T7 `0f0293b`. Un commit por tarea, salvo los
bugs (rojo + arreglo, excepción declarada en RNF-4). `MEMORY.md` actualizado en cada tarea.

## Constitución

Principio 1: cada cambio de comportamiento está en la spec (RF-6 a RF-8, RF-10). Principio 2:
ninguna tarea `[x]` en rojo (los commits rojos no marcan `[x]`). Principio 3: el tope de `skip` y
`@TrimToNull` en DTOs, la función SQL en la capa de base de datos, `assignDefined` en los
services; controllers sin cambios. Principio 4: sin `any` ni casts para compilar. Principio 6:
código en inglés, comentarios y mensajes en español. `docs/constitution.md` sin cambios.

## Observaciones (no bloquean)

1. **Son 26 operaciones documentadas, no 25**: la spec contaba como el TP-2, pero `/docs-json`
   también documenta `GET /` (página de inicio). El contrato la cubre (RF-4 pide "todas").
2. `test/contract/contract-case.ts` no figuraba en el plan: separa los tipos compartidos por los
   dos archivos de casos.
3. El inventario NO fija la cantidad de operaciones: cuando el TP-3/TP-4 agreguen endpoints, el
   contrato les va a exigir sus casos, sin modificar tests existentes.
4. Hallazgos anotados en la spec, fuera de alcance: `Milliseconds`/`Bytes` aceptan enteros fuera
   del rango seguro; `UnitPrice` mayor que `NUMERIC(10,2)`; la comparación de `email` tiene la
   misma limitación de mayúsculas no ASCII que tenía RF-7.
5. La cobertura medida con los e2e no se usa (contaba los `*.spec.ts` como código); el gate mide
   solo los tests unitarios, como fija la spec.
