# Tareas 004 — Reservas de entradas con pago y transacciones (TP-4)

Estado: **aprobado** (16/11, Alexis Napoli) · Plan: `specs/004-reservas/plan.md`

Reglas: una tarea por vez, tests primero (en rojo), gates en verde (`lint`, `build`, `test`,
`test:e2e`, `test:cov`, `typecheck`), un commit `004-Tn: …` en la rama `tp-4-reservas`, `[x]` y
`MEMORY.md`. Push con OK; entra a `main` por PR.

- [x] **T1. Infraestructura de base.** RNF-4
      `migrations.ts` (Concert, Reservation, Payment, índices; idempotente), `prepareConnection`
      (funciones SQL + migraciones) en `DatabaseModule`, `TransactionLock`, `Clock`.
      Hecho cuando: `pnpm test` pasa: migración sobre una copia real crea las 3 tablas y correrla dos
      veces no falla ni duplica; índice único `(UserId, IdempotencyKey)` rechaza el repetido; el
      candado ejecuta en orden FIFO y sigue con el siguiente aunque uno falle.
      Estimación: 25 min · depende de: —

- [x] **T2. Conciertos.** RF-1, RF-2, RF-14 · casos 24, 26
      Entity, DTOs (alta con `StartsAt` con zona y futuro), repository con disponibilidad
      calculada, service, controller (`GET` públicos, `POST` admin); `ArtistsService.remove`
      cuenta conciertos; casos de contrato; `protection.e2e`/`docs.e2e` actualizados.
      Hecho cuando: `pnpm test:e2e` pasa `concerts.e2e` (alta, validaciones, 401/403, disponibilidad
      = capacidad sin reservas, artista con conciertos → 409) y el inventario del contrato.
      Estimación: 35 min · depende de: T1

- [x] **T3. Máquina de estados y gateway de pago.** RF-11, RNF-3 · caso 7
      `assertTransition` pura; `PaymentGateway` (interfaz, token, simulado).
      Hecho cuando: `pnpm test` pasa la tabla completa de transiciones (3 válidas, todas las demás
      → `ConflictException`, incluida `PAID → PENDING`) y el gateway simulado aprueba.
      Estimación: 15 min · depende de: —

- [x] **T4. Reserva atómica y consultas.** RF-3–RF-6, RF-8, RF-12, RNF-1, RNF-5 · casos 2, 3, 5, 6, 9–12, 14, 18–20, 22, 25
      Entities, DTO de alta (+ header `Idempotency-Key`), repository, service (candado +
      transacción), controller (`POST`, `GET` lista, `GET` detalle); contrato e inventario.
      Hecho cuando: `pnpm test:e2e` pasa `reservations.e2e` con esos casos (rollback verificado por
      SQL: 0 reservas y 0 pagos nuevos) y el contrato.
      Estimación: 45 min · depende de: T2, T3

- [x] **T5. Concurrencia y transacción abierta.** RF-6, RF-7, RF-13, RNF-2 · casos 1, 8, 13, 21
      `reservations-concurrency.e2e` con gateway que cede el turno (`setImmediate`) y con barrera.
      Hecho cuando: los 4 casos pasan sin `sleep`; mutación: sin el candado el test de la última
      entrada o el de muchas reservas falla (se revierte y se documenta).
      Estimación: 30 min · depende de: T4

- [x] **T6. Cancelar y completar.** RF-9, RF-10, RF-11 · casos 4, 7, 15–17, 23
      Acciones `cancel` (dueño, reembolso, idempotente) y `complete` (admin, idempotente), con el
      `Clock` adelantado en los tests; contrato.
      Hecho cuando: `pnpm test:e2e` pasa los casos y el cupo vuelve una sola vez tras dos cancelaciones.
      Estimación: 30 min · depende de: T4

- [x] **T7. Modificaciones simultáneas del catálogo.** RF-15 · caso 27
      Hecho cuando: dos `PATCH` simultáneos al mismo artista → 200 y 200, y el `GET` final coincide
      entero con uno de los dos.
      Estimación: 10 min · depende de: —

- [ ] **T8. Valores numéricos como parámetros (hallazgo de la validación).** RNF-5
      La validación encontró que las búsquedas y actualizaciones por id de reservas y pagos
      (`findOneBy`, `update`) dejan los números escritos como literal en el SQL: el driver de
      SQLite de TypeORM inlinea todo parámetro `number` (mismo hallazgo que el TP-3). Se pasan a
      QueryBuilder con `CAST(? AS INTEGER)`. Agregada con aprobación del usuario (16/11).
      Hecho cuando: un test que registra el SQL ejecutado en alta, consultas, cancelación y
      completado verifica que ninguna condición compara contra un número literal (en rojo antes
      del cambio); `LIMIT`/`OFFSET` exceptuados como en la spec 003; gates en verde.
      Estimación: 15 min · depende de: T7

Después de T8: `validate.md`, push de la rama con OK, PR y merge del usuario.
