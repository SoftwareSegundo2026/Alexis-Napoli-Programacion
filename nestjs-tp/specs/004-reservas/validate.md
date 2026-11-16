VEREDICTO: APROBADO

# Validación 004 — Reservas de entradas con pago y transacciones (TP-4)

Fecha: 16/11/2026 · Rol: reviewer · Rama `tp-4-reservas`
Insumos: `spec.md`, `clarify.md`, `plan.md`, `tasks.md`, `MEMORY.md`, `docs/constitution.md`,
`consignas/TP4-reservas-transacciones.md`, el código y `git log`.

> **Hallazgo durante la validación (ya corregido):** la primera pasada encontró que las
> búsquedas y actualizaciones por id de reservas y pagos (`findOneBy`, `update`) dejaban los ids
> escritos como literal en el SQL (`WHERE "ReservationId" = 2`): el driver de SQLite de TypeORM
> inlinea todo parámetro `number` (el mismo hallazgo del TP-3). No era inyectable (son números
> validados), pero contradecía RNF-5. Con aprobación del usuario se agregó la **T8** (`9e2a01f`),
> implementada en `45e50d7`: QueryBuilder con `CAST(:x AS INTEGER)` y un test que registra el SQL
> ejecutado (en rojo antes del cambio: 11 consultas). El resto del código nuevo ya parametrizaba
> (`concerts.repository` con `CAST`, `countConcerts` con `?`).

## Gates (ejecutados en esta validación, tras T8)

| Gate | Resultado |
|---|---|
| `pnpm lint` | 0 errores, 0 avisos |
| `pnpm build` | OK |
| `pnpm test` | 413 en verde |
| `pnpm test:e2e` | 495 en verde (incluye contrato e inventario de `/docs-json`) |
| `pnpm test:cov` | líneas 81,12% · ramas 83,68% (umbral 75/75) |
| `pnpm typecheck` | OK (también `test/`) |

El job `gates` de CI se verifica en el PR (RNF-6).

## Requisitos → tests → resultado

| RF | Test | Resultado |
|---|---|---|
| RF-1 alta de concierto | `concerts.e2e` "alta válida → 201…", `it.each` de validaciones (fecha pasada, sin zona, artista inexistente, campos); `concerts.service.spec` (reloj) | OK |
| RF-2 disponibilidad calculada | `concerts.e2e` (disponibilidad = capacidad); casos 4, 6, 13 y `RF-7` del ciclo de vida la recalculan; no hay columna de disponibilidad (`migrations.ts`) | OK |
| RF-3 concierto empezado | `reservations.e2e` caso 5 (400, sin cobro) | OK |
| RF-4 reserva + pago atómicos | `reservations.e2e` "reserva y paga… 201 PAID"; `reservations.service.spec` | OK |
| RF-5 rollback | `reservations.e2e` casos 2 (402) y 20 (500), verificados por SQL: 0 reservas y 0 pagos nuevos; `service.spec` `it.each(['reject','error'])` | OK |
| RF-6 idempotencia | casos 3, 11, 12, 21, 22; "un intento rechazado no gasta la clave" | OK |
| RF-7 sin sobreventa | `reservations-concurrency.e2e` casos 1 y 13; ciclo de vida "usa el cupo de una cancelación ya confirmada" | OK |
| RF-8 sin cupo → 409 con lo que queda | `reservations.e2e` caso 6 | OK |
| RF-9 cancelar | `reservations-lifecycle.e2e` casos 4, 14, 15; reembolso `REFUNDED` verificado | OK |
| RF-10 completar | `reservations-lifecycle.e2e` casos 16, 17, 23 | OK |
| RF-11 máquina de estados | `reservation-status.spec` (las 16 combinaciones: 3 válidas, 13 → 409, incluida `PAID → PENDING`); por HTTP caso 7 | OK |
| RF-12 solo lo propio | `reservations.e2e` "consultas (RF-12)" y caso 14; ciclo de vida caso 14 (cancelar ajena → 404) | OK |
| RF-13 estado confirmado | `reservations-concurrency.e2e` caso 8 (pago detenido en una barrera) | OK |
| RF-14 artista con conciertos | `concerts.e2e` "borrar un artista con conciertos… → 409" (caso 26) | OK |
| RF-15 PATCH simultáneos | `catalog-concurrency.e2e` caso 27 (10 rondas) | OK |

## Requisitos no funcionales

| RNF | Evidencia | Resultado |
|---|---|---|
| RNF-1 misma transacción | `reservations.service.ts:52-116`: dentro de un solo `dataSource.transaction` → `insert` (88), `gateway.charge` (99), `insertPayment` (110), `PAID` (116); cancelación + `refundPayment` (130-153) también. Los casos 2/20 lo prueban por el efecto (rollback completo) | OK |
| RNF-2 sin `sleep` | Barrera en el gateway de prueba + `until(cond)` que cede el turno con `setImmediate` y `TransactionLock.pending`. `grep` de `sleep`/`setTimeout` en tests y código de reservas: sin resultados | OK |
| RNF-3 pago inyectable | Token `PAYMENT_GATEWAY`; los tests usan `ControllablePaymentGateway` (`withDoubles`); el simulado de producción no tiene flag de fallo | OK |
| RNF-4 migración en código | `migrations.spec` (crea las 3 tablas; dos corridas no fallan ni duplican; índice único por usuario y clave; FK activas); `database.e2e` (template intacto) | OK |
| RNF-5 valores como parámetros | `reservations.service.spec` "ninguna condición del SQL compara contra un número literal (RNF-5, T8)" | OK (tras T8) |
| RNF-6 contrato, cobertura, rama | Contrato: `concerts.cases.ts` y `reservations.cases.ts` con inventario completo; `protection.e2e`/`docs.e2e` en 34 operaciones; cobertura 81/84; rama `tp-4-reservas` | OK (CI en el PR) |

## Casos límite (1–27)

| # | Test | # | Test |
|---|---|---|---|
| 1 | `reservations-concurrency` caso 1 | 15 | `reservations-lifecycle` caso 15 |
| 2 | `reservations` caso 2 | 16 | `reservations-lifecycle` caso 16 |
| 3 | `reservations` caso 3 | 17 | `concerts` (viewer → 403) y `reservations-lifecycle` caso 17 |
| 4 | `reservations-lifecycle` caso 4 | 18 | `reservations` caso 18 |
| 5 | `reservations` caso 5 | 19 | `reservations` caso 19 (0, 11, 1.5) |
| 6 | `reservations` caso 6 | 20 | `reservations` caso 20 |
| 7 | `reservation-status.spec` + `reservations-lifecycle` caso 7 | 21 | `reservations-concurrency` caso 21 |
| 8 | `reservations-concurrency` caso 8 | 22 | `reservations-lifecycle` caso 22 |
| 9 | `reservations` caso 9 | 23 | `reservations-lifecycle` caso 23 |
| 10 | `reservations` caso 10 (sin clave, corta) | 24 | `concerts` `it.each` (sin zona) |
| 11 | `reservations` caso 11 | 25 | `reservations` caso 25 |
| 12 | `reservations` caso 12 | 26 | `concerts` RF-14 |
| 13 | `reservations-concurrency` caso 13 | 27 | `catalog-concurrency` caso 27 |
| 14 | `reservations` y `reservations-lifecycle` caso 14 | | |

Los 8 casos obligatorios de la consigna son los casos 1–8 de la spec, con el mismo significado.

## Pruebas de mutación (los tests detectan el error)

- **T5, sin el candado** (`TransactionLock`): el caso 13 vendió **12 entradas de 5**, el caso 1
  dio `[201, 500]` (transacción anidada como SAVEPOINT) y el caso 21 falló. El caso 8 siguió
  pasando: lo protege que `PENDING` no cuenta en la disponibilidad, no el candado. Revertido.
- **T7, "guardar solo el nombre"** en el PATCH de artistas: el caso 27 **falló** (detecta la
  mezcla). Una primera mutación (guardar campo por campo cediendo el turno) no mezcló porque Node
  atiende en orden; era una mala mutación, no un mal test. Revertidas.
- **T8**: el test de RNF-5 estuvo en rojo (11 consultas) antes del cambio.

## Lo que la consigna dice que busca el reviewer

| Punto | Estado |
|---|---|
| `INSERT` de reserva y de pago fuera de la misma transacción | No: los dos con el mismo `manager` de la transacción (RNF-1) |
| Disponibilidad leída y escrita sin bloqueo/condición | No: la disponibilidad se calcula (no se escribe) y la verificación + alta corren bajo `TransactionLock`, dentro de la transacción |
| Test de concurrencia ausente o con `sleep` | No: 4 casos concurrentes sin `sleep`, con mutación que lo demuestra |
| Estado cambiado por el cliente en el body | No: `Status` en el cuerpo → 400 (caso 9); el estado solo cambia por acciones del servidor |
| Cancelación que libera cupo sin verificar que estuviera pagada | No: `assertTransition(status, 'CANCELLED')` solo admite `PAID` (y `CANCELLED` repetida se devuelve sin cambios) |

## Constitución

Sin `any`, sin `@ts-ignore`, sin casts forzados (un cast de un test de T2 se reemplazó por un
módulo de prueba con `useValue`); ningún test borrado; `docs/constitution.md` sin tocar.

## Proceso

Spec + clarify (`18d0203`; ronda 1 CAMBIOS NECESARIOS, ronda 2 APROBADA) → plan y tareas
(`6dde10b`) → T1 `b45b308` · T2 `18319e9` · T3 `f93be55` · T4 `5e4c478` · T5 `0d0cea2` ·
T6 `7239b50` · T7 `401ca31` → hallazgo de la validación → T8 aprobada (`9e2a01f`) e implementada
(`45e50d7`). `MEMORY.md` actualizado en cada tarea.

## Observaciones (no bloquean)

1. **Desvío en T2:** por apuro no se corrió el rojo de los e2e de conciertos antes de
   implementar (los tests sí se escribieron antes). Está registrado en `MEMORY.md`. El gate de
   cobertura cortó esa tarea (71,48%) y obligó a sumar unit tests: lo corrigió el propio proceso.
2. **Tests anteriores actualizados** (no borrados ni debilitados): `protection.e2e` y
   `docs.e2e` pasan de 26 a 34 operaciones, con las nuevas en su lista (pública o autenticada).
3. **Una sola conexión:** better-sqlite3 con TypeORM comparte la conexión, así que la
   concurrencia se resuelve con un candado FIFO en el proceso. Alcanza para esta app (un proceso);
   con varias instancias haría falta un motor con bloqueos de fila (p. ej. PostgreSQL).
4. **Fuera del TP-4:** los demás repositories (`findById` de artistas, géneros, usuarios, etc.)
   siguen pasando ids numéricos que el driver escribe como literal (ya anotado en el TP-3). No es
   inyectable; queda para revisar en un TP futuro.
5. El log de los e2e muestra un `ERROR` del caso 20 (falla inesperada del pago, esperada) y un
   aviso de Node `MaxListenersExceededWarning` del servidor de pruebas; no afectan los resultados.
