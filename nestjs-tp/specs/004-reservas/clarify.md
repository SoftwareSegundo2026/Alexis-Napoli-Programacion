# Clarify 004 — Informe QA de la spec (rol reviewer)

> Solo detecciones, sin soluciones (`/sdd-clarify 004-reservas`).
> Revisión contra `spec.md` (aprobada el 16/11), `docs/constitution.md`, las specs anteriores,
> `specs/001-chinook-nest/validate.md` y `consignas/TP4-reservas-transacciones.md`.

## Ronda 1 — 16/11

### Los 8 casos límite obligatorios de la consigna

| # consigna | Situación | ¿Está en la spec? |
|---|---|---|
| 1 | Dos reservas simultáneas por el último cupo | Sí: RF-7, caso 1 |
| 2 | Pago que falla a mitad de la transacción | Sí: RF-5, RNF-1, casos 2 y 20 |
| 3 | Reintento del mismo pago | Sí: RF-6, caso 3 (ver A2, A3) |
| 4 | Cancelar dos veces | Sí: RF-9, caso 4 |
| 5 | Reserva en el pasado → 400 | Sí: RF-3, caso 5 (ver A1) |
| 6 | Más cupos que los disponibles → 409 con el restante | Sí: RF-8, caso 6 |
| 7 | Estado inválido (PAGADA → PENDIENTE) → 409 | Sí: RF-11, caso 7 (ver T1) |
| 8 | Disponibilidad durante una transacción abierta | Sí: RF-13, caso 8 (ver T2) |

Y lo que la consigna dice que el revisor va a buscar: reserva y pago en la misma transacción
(RNF-1 ✓), disponibilidad sin condición de carrera (RF-7 ✓, ver T2), test sin `sleep` (RNF-2 ✓),
estado enviado por el cliente (RF-11, caso 9 ✓), cancelar sin verificar el pago (RF-9 ✓).

Detecciones adicionales:

### 1. Ambigüedades

- **A1.** `StartsAt` se devuelve "en UTC", pero no se define qué formato se **acepta** en el alta
  (¿`2026-12-01T21:00` sin zona?, ¿con offset `-03:00`?). Sin zona, "futuro" depende de la zona
  horaria del servidor.
- **A2.** RF-6 dice "la misma respuesta de la primera vez", pero no aclara qué devuelve un
  reintento **después** de que la reserva cambió (p. ej. ya cancelada): ¿el cuerpo original o el
  estado actual? Tampoco dice qué significa "mismo cuerpo" (¿comparar `ConcertId` y `Quantity`?)
  ni cuánto tiempo se recuerda una clave.
- **A3.** RF-6 no cubre dos pedidos **simultáneos** con la misma clave (el doble clic real): si
  los dos pasan el chequeo "clave no usada" antes de que alguno termine, se cobraría dos veces.
- **A4.** Un concierto con `Price` 0 da `Amount` 0: no se define si igual se "cobra" (pago de 0)
  o si se omite el pago.

### 2. Contradicciones

- **K1.** La spec 001 (RF-12) impide borrar un artista **con álbumes**. Ahora un artista puede
  tener **conciertos** sin tener álbumes: borrarlo dejaría conciertos (y reservas pagas)
  huérfanos, que es justo lo que las specs anteriores prohíben ("borrado de un recurso en uso → 409").
- **K2.** `001/validate.md` dejó para el TP-4 el test de "dos modificaciones simultáneas → queda
  la última". La spec 004 no lo menciona: queda un pendiente heredado sin dueño.

### 3. Casos límite no cubiertos

- **C1.** Completar una reserva ya `COMPLETED` → 409 (RF-10), mientras que cancelar una ya
  `CANCELLED` → 200 (RF-9). La asimetría no está justificada.
- **C2.** Cancelación y reserva **simultáneas** sobre el mismo concierto: no se dice si la
  reserva puede usar el cupo que se está liberando.

### 4. Conflictos con la constitution / reglas no comprobables

- **T1.** RF-11 / caso 7 (`PAID → PENDING`): ninguna operación de la API pide esa transición, así
  que no se puede probar por HTTP tal como está escrito. No se dice cómo se verifica.
- **T2.** RF-13 / caso 8 exige consultar "durante" una transacción abierta, sin `sleep` (RNF-2).
  No se define cómo el test detiene una reserva a la mitad de forma determinista.

### 5. RF sin criterio de aceptación / dudas abiertas

- **R1.** RF-12 y RF-13 no aparecen en ninguna historia ni aceptación.

**VEREDICTO: CAMBIOS NECESARIOS** (A1–A4, K1–K2, C1–C2, T1–T2, R1)

## Ronda 2 — 16/11

Revisión de la spec corregida (resoluciones aprobadas por el usuario).

| Detección | Dónde quedó resuelta | Estado |
|---|---|---|
| A1 | Contrato (alta de concierto): zona explícita; caso 24 | Resuelta |
| A2 | RF-6: mismo cuerpo = `ConcertId` + `Quantity`; reintento = reserva en su estado actual; caso 22 | Resuelta |
| A3 | RF-6: clave única por usuario, también ante pedidos simultáneos; caso 21 | Resuelta |
| A4 | Caso 25: pago de 0 | Resuelta |
| K1 | RF-14 y caso 26 | Resuelta |
| K2 | RF-15 y caso 27 | Resuelta |
| C1 | RF-10: completar idempotente; caso 23 | Resuelta |
| C2 | RF-7: solo cupo de cancelaciones confirmadas | Resuelta |
| T1 | RF-11: función pura con todos los pares; HTTP para los alcanzables | Resuelta |
| T2 | RF-13: barrera controlada por el test, sin `sleep` | Resuelta |
| R1 | HU-1 (RF-13) y HU-7 (RF-12) | Resuelta |

Verificaciones de la ronda 2: RF-14 extiende (no contradice) la spec 001 RF-12; RF-15 cierra el
pendiente de `001/validate.md`; los 8 casos obligatorios siguen cubiertos y cada RF tiene caso o
método de verificación; ningún requisito depende de tiempos (RNF-2).

**VEREDICTO: APROBADA**
