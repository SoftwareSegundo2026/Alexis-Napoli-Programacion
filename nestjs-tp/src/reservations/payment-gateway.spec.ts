import {
  PaymentRejectedError,
  SimulatedPaymentGateway,
} from './payment-gateway.js';

/** Pago simulado (spec 004 RNF-3): la app aprueba siempre; los tests lo reemplazan. */
describe('SimulatedPaymentGateway', () => {
  it('aprueba cualquier cobro, también de 0 (caso 25)', async () => {
    const gateway = new SimulatedPaymentGateway();

    await expect(
      gateway.charge({ reservationId: 1, amount: 51 }),
    ).resolves.toBeUndefined();
    await expect(
      gateway.charge({ reservationId: 2, amount: 0 }),
    ).resolves.toBeUndefined();
  });

  it('PaymentRejectedError es un Error con su propio nombre (lo traduce el service a 402)', () => {
    const error = new PaymentRejectedError('Tarjeta rechazada');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('PaymentRejectedError');
    expect(error.message).toBe('Tarjeta rechazada');
  });
});
