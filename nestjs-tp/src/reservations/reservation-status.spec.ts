import { ConflictException } from '@nestjs/common';
import {
  assertTransition,
  RESERVATION_STATUSES,
  type ReservationStatus,
} from './reservation-status.js';

/** Máquina de estados de la reserva (spec 004 RF-11, caso 7). */
describe('assertTransition', () => {
  const VALID: Array<[ReservationStatus, ReservationStatus]> = [
    ['PENDING', 'PAID'],
    ['PAID', 'CANCELLED'],
    ['PAID', 'COMPLETED'],
  ];
  const isValid = (from: ReservationStatus, to: ReservationStatus) =>
    VALID.some(([f, t]) => f === from && t === to);

  // Los 16 pares posibles: los 3 válidos pasan, los otros 13 → 409.
  const ALL_PAIRS = RESERVATION_STATUSES.flatMap((from) =>
    RESERVATION_STATUSES.map((to): [ReservationStatus, ReservationStatus] => [
      from,
      to,
    ]),
  );

  it('hay exactamente 16 pares y 3 transiciones válidas', () => {
    expect(ALL_PAIRS).toHaveLength(16);
    expect(ALL_PAIRS.filter(([from, to]) => isValid(from, to))).toHaveLength(3);
  });

  it.each(VALID)('%s → %s es válida', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(ALL_PAIRS.filter(([from, to]) => !isValid(from, to)))(
    '%s → %s es inválida → 409 que nombra los dos estados',
    (from, to) => {
      expect(() => assertTransition(from, to)).toThrow(ConflictException);
      expect(() => assertTransition(from, to)).toThrow(
        `Invalid status transition: ${from} → ${to}`,
      );
    },
  );

  it('PAID → PENDING (el ejemplo de la consigna) → 409', () => {
    expect(() => assertTransition('PAID', 'PENDING')).toThrow(
      ConflictException,
    );
  });
});
