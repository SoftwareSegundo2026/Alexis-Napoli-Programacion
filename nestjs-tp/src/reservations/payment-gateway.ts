import { Injectable } from '@nestjs/common';

/** Lo que se le pide cobrar al medio de pago. */
export interface ChargeRequest {
  reservationId: number;
  amount: number;
}

/**
 * Medio de pago (spec 004 RNF-3). Es una dependencia INYECTABLE: la app usa el
 * simulado y los tests lo reemplazan (`overrideProvider(PAYMENT_GATEWAY)`) para
 * forzar un rechazo, un error o una pausa. No hay un flag de "fallar" en producción.
 *
 * `charge` resuelve si el cobro se aprobó y lanza `PaymentRejectedError` si se
 * rechazó; cualquier otro error es un fallo inesperado.
 */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<void>;
}

/** Token de inyección del medio de pago. */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

/** El medio de pago rechazó el cobro (→ 402, spec 004 RF-5). */
export class PaymentRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentRejectedError';
  }
}

/** Pago simulado de la app: aprueba siempre, sin esperar E/S. */
@Injectable()
export class SimulatedPaymentGateway implements PaymentGateway {
  // El simulado no usa el pedido: aprueba cualquier importe.
  charge(_request: ChargeRequest): Promise<void> {
    return Promise.resolve();
  }
}
