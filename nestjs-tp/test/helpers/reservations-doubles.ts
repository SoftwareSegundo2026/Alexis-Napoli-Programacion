import type { TestingModuleBuilder } from '@nestjs/testing';
import { Clock } from '../../src/database/clock.js';
import {
  PAYMENT_GATEWAY,
  PaymentRejectedError,
  type ChargeRequest,
  type PaymentGateway,
} from '../../src/reservations/payment-gateway.js';

/**
 * Medio de pago CONTROLABLE para los tests (spec 004 RNF-3): reemplaza al
 * simulado de la app con `overrideProvider`. No es un flag de producción.
 */
export class ControllablePaymentGateway implements PaymentGateway {
  /** Qué hace el próximo cobro: aprobar, rechazar o fallar con un error inesperado. */
  mode: 'approve' | 'reject' | 'error' = 'approve';
  /** Cobros aprobados (para verificar que no se cobró dos veces). */
  readonly approved: ChargeRequest[] = [];
  /** Si está, cada cobro la espera antes de resolver (concurrencia y barrera). */
  pause?: () => Promise<void>;

  async charge(request: ChargeRequest): Promise<void> {
    if (this.pause !== undefined) {
      await this.pause();
    }
    if (this.mode === 'reject') {
      throw new PaymentRejectedError('Pago rechazado por el medio de pago');
    }
    if (this.mode === 'error') {
      throw new Error('Falla inesperada del medio de pago');
    }
    this.approved.push(request);
  }
}

/** Reloj que el test puede adelantar (spec 004: "el concierto ya empezó"). */
export class FakeClock extends Clock {
  current = new Date();

  override now(): Date {
    return new Date(this.current.getTime());
  }
}

/** Reemplaza el medio de pago y el reloj de la app por los dobles del test. */
export function withDoubles(
  gateway: ControllablePaymentGateway,
  clock: FakeClock,
): (builder: TestingModuleBuilder) => TestingModuleBuilder {
  return (builder) =>
    builder
      .overrideProvider(PAYMENT_GATEWAY)
      .useValue(gateway)
      .overrideProvider(Clock)
      .useValue(clock);
}
