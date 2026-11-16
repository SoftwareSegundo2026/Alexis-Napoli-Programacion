# Plan 004 — Reservas de entradas con pago y transacciones (TP-4)

Estado: **aprobado** (16/11, Alexis Napoli) · Spec: `specs/004-reservas/spec.md` (aprobada el 16/11, clarify ronda 2)

## Dependencias nuevas

**Ninguna.**

## Hallazgo que define el diseño (código de TypeORM 1.1.3, verificado el 16/11)

- `BetterSqlite3Driver.createQueryRunner`: `this.queryRunner ??= new …` → **una sola conexión**
  compartida por todos los pedidos.
- `AbstractSqliteQueryRunner.startTransaction`: si ya hay una transacción abierta, la nueva se
  convierte en un `SAVEPOINT` **dentro** de la primera.
- Consecuencia: dos reservas simultáneas, sin protección, quedarían anidadas en la misma
  transacción; el rollback del pago fallido de una se llevaría puesta a la otra, y las dos
  leerían la disponibilidad antes de que la otra escribiera (sobreventa).

**Decisión:** un candado en memoria (`TransactionLock`, cola FIFO de promesas, como la cola de
altas de usuarios del TP-2) por el que pasa **toda** transacción de reservas (alta, cancelación,
completado). Dentro del candado: `dataSource.transaction(...)`. Así las transacciones de reservas
nunca se superponen (RF-7) y la verificación de disponibilidad + el `INSERT` ocurren sin que nadie
más escriba en el medio. Es válido porque la app es **un solo proceso** con **una sola conexión**:
lo que hay que serializar está todo en memoria. (Con varias instancias haría falta un bloqueo en
la base; fuera de alcance, se documenta.)

## Estructura

```
src/database/
├── migrations.ts          ← NUEVO: CREATE TABLE IF NOT EXISTS Concert, Reservation, Payment (+ índices)
├── prepare-connection.ts  ← NUEVO: registerSqlFunctions + runMigrations (prepareDatabase lo llama)
├── transaction-lock.ts    ← NUEVO: candado FIFO
└── clock.ts               ← NUEVO: Clock inyectable (now()); los tests lo adelantan
src/concerts/              ← NUEVO módulo: entity, dto (alta, respuesta), repository (disponibilidad), service, controller
src/reservations/          ← NUEVO módulo:
├── reservation-status.ts  ← máquina de estados PURA: assertTransition(from, to) → 409
├── payment-gateway.ts     ← interfaz + token PAYMENT_GATEWAY + SimulatedPaymentGateway (aprueba)
├── entities (Reservation, Payment), dto, repository, service, controller
src/artists/artists.service.ts ← RF-14: borrar con conciertos → 409
test/reservations*.e2e-spec.ts, test/concerts.e2e-spec.ts, test/catalog-concurrency.e2e-spec.ts
test/contract/* (casos nuevos) · test/protection.e2e y docs.e2e (cantidad de operaciones)
```

## Decisiones (y por qué)

- **Migración en código (RNF-4):** `runMigrations(db)` ejecuta `CREATE TABLE/INDEX IF NOT EXISTS`
  al abrir la conexión (dentro de `prepareDatabase`, junto con `unicode_lower`). La base template
  no cambia; los tests y la app crean las tablas solas. Índice único `(UserId, IdempotencyKey)`
  en `Reservation` (RF-6) e índice `(ConcertId, Status)` para la disponibilidad.
- **Disponibilidad calculada (RF-2):** `Capacity - COALESCE(SUM(Quantity), 0)` sobre reservas
  `PAID`/`COMPLETED`, en la misma consulta del concierto. Ningún campo la guarda.
- **Alta de reserva (RF-4, RF-5, RF-6, RF-8):** `lock.run(() => transaction(async (manager) => {
  1) ¿clave ya usada por el usuario? → misma reserva (o 409 si otro cuerpo);
  2) concierto existe (404) y no empezó (400, con el Clock);
  3) disponibilidad ≥ Quantity, si no 409 con las que quedan;
  4) INSERT reserva PENDING; 5) gateway.charge(Amount) → rechazo = excepción 402;
  6) INSERT pago APPROVED; 7) UPDATE reserva PAID }))`. Cualquier excepción → rollback completo.
- **Pago simulado (RNF-3):** interfaz `PaymentGateway` con token de inyección; la app registra
  `SimulatedPaymentGateway` (aprueba siempre). Los tests reemplazan el provider con
  `overrideProvider(PAYMENT_GATEWAY)`: rechazo, error inesperado, o una **barrera** (promesa que el
  test libera) para RF-13 y para forzar la superposición en el test de concurrencia.
- **Máquina de estados (RF-11):** función pura `assertTransition(from, to)` con la tabla de
  transiciones permitidas; todo lo demás → `ConflictException`. Cancelar/completar repetidos se
  resuelven **antes** de llamarla (idempotencia, RF-9/RF-10).
- **Clock inyectable:** "ya empezó" depende de la hora; los tests de completar y de cancelar
  tarde adelantan el reloj en vez de crear conciertos en el pasado (que es 400 por RF-1).
- **Privacidad (RF-12):** el repository busca por `(id, userId)` salvo admin → 404 si es de otro.
- **`Status` en el cuerpo (caso 9):** el DTO de alta no lo declara → el pipe global lo rechaza (400).
- **RF-14:** `ArtistsService.remove` cuenta también los conciertos.
- **RF-15:** los `PATCH` del catálogo ya leen-modifican-guardan sin `await` real entre medio
  (better-sqlite3 es síncrono): se prueba con dos `PATCH` simultáneos que cambian campos distintos
  y se verifica que el resultado es uno de los dos completo.
- **Inventario:** 8 operaciones nuevas → contrato (sus casos), `protection.e2e` (2 públicas,
  4 de cualquier rol autenticado) y `docs.e2e` (cantidades), actualizados como en el TP-3.

## Estrategia de tests (sin `sleep`, RNF-2)

| Qué | Cómo |
|---|---|
| Concurrencia (casos 1, 13, 21) | `Promise.all` de N pedidos HTTP con un gateway que cede el turno con `setImmediate` (no un tiempo): sin el candado las transacciones se superponen. Invariante: vendidas ≤ capacidad, un cobro por clave. **Mutación:** sin el candado el test falla |
| Transacción abierta (caso 8) | Gateway con barrera: el test lanza la reserva, espera la señal "estoy cobrando", consulta `GET /concerts/{id}` (disponibilidad sin cambios), libera la barrera |
| Rollback (casos 2, 20) | Gateway que rechaza / que tira error: 402 / 500 y, por SQL, 0 reservas y 0 pagos nuevos |
| Estados (caso 7) | Unit de `assertTransition` con todos los pares; HTTP para completar cancelada / cancelar completada |

## Riesgos

- **Superposición con otras escrituras:** una escritura del catálogo que llegara mientras una
  reserva espera al gateway caería dentro de esa transacción (misma conexión). Con el gateway
  simulado (resuelve sin E/S) no hay espera real; se documenta como límite y como motivo para,
  con un gateway real, cobrar fuera de la transacción con compensación.
- **Tamaño:** es el TP más grande; tareas de 30–40 min con gates por tarea.

## Tareas (se detallan en `tasks.md` tras aprobar este plan)

1. **T1** — Migración, `prepareConnection`, `TransactionLock`, `Clock`.
2. **T2** — Conciertos (alta, listado, detalle, disponibilidad) + RF-14 + contrato.
3. **T3** — Máquina de estados y gateway de pago (unit).
4. **T4** — Alta atómica de reserva + consultas + idempotencia + contrato.
5. **T5** — Concurrencia y transacción abierta (casos 1, 8, 13, 21) + mutación sin candado.
6. **T6** — Cancelar y completar (casos 4, 7, 14–17, 23) + contrato.
7. **T7** — RF-15 (PATCH simultáneos del catálogo).
