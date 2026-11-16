import { ConflictException } from '@nestjs/common';

/** Estados de una reserva (spec 004): PENDIENTE, PAGADA, CANCELADA, COMPLETADA. */
export const RESERVATION_STATUSES = [
  'PENDING',
  'PAID',
  'CANCELLED',
  'COMPLETED',
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/**
 * Las ÚNICAS transiciones válidas (spec 004 RF-11). `PENDING` solo existe dentro
 * de la transacción de alta: hacia afuera una reserva nace `PAID` o no existe.
 */
const ALLOWED: ReadonlyArray<readonly [ReservationStatus, ReservationStatus]> =
  [
    ['PENDING', 'PAID'],
    ['PAID', 'CANCELLED'],
    ['PAID', 'COMPLETED'],
  ];

/**
 * Máquina de estados pura: lanza 409 ante cualquier transición que no esté en
 * la tabla (p. ej. `PAID → PENDING`). El estado lo cambian solo acciones del
 * servidor; repetir una acción ya hecha (cancelar una cancelada) se resuelve
 * ANTES de llamar a esta función, porque no es una transición nueva.
 */
export function assertTransition(
  from: ReservationStatus,
  to: ReservationStatus,
): void {
  if (!ALLOWED.some(([f, t]) => f === from && t === to)) {
    throw new ConflictException(`Invalid status transition: ${from} → ${to}`);
  }
}
