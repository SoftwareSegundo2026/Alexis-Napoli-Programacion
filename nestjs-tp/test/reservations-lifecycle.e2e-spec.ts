import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { bearer, seedTestUsers } from './helpers/auth.js';
import {
  ControllablePaymentGateway,
  FakeClock,
  withDoubles,
} from './helpers/reservations-doubles.js';
import { createTestApp } from './helpers/test-app.js';

interface ReservationBody {
  ReservationId: number;
  Status: string;
}

interface ErrorBody {
  detail: string;
}

const RESERVATIONS = '/api/v1/reservations';
const CONCERTS = '/api/v1/concerts';
const STARTS_AT = '2099-06-01T21:00:00Z';
const AFTER_START = new Date('2099-06-02T00:00:00Z');

/** Cancelar y completar (spec 004 RF-9, RF-10, RF-11; casos 4, 7, 15–17, 22, 23). */
describe('Ciclo de vida de la reserva (e2e, spec 004)', () => {
  let app: INestApplication<App>;
  const gateway = new ControllablePaymentGateway();
  const clock = new FakeClock();
  let viewerToken = '';
  let adminToken = '';
  let keyCounter = 0;

  beforeAll(async () => {
    app = await createTestApp(withDoubles(gateway, clock));
    const users = await seedTestUsers(app);
    viewerToken = users.viewerToken;
    adminToken = users.adminToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clock.current = new Date();
  });

  const http = () => request(app.getHttpServer());
  const nextKey = () => `clave-ciclo-${++keyCounter}`;
  const as = (token: string, test: request.Test) =>
    test.set('Authorization', bearer(token));

  async function createConcert(capacity = 10): Promise<number> {
    const response = await as(adminToken, http().post(CONCERTS))
      .send({
        ArtistId: 1,
        Title: `Ciclo ${++keyCounter}`,
        StartsAt: STARTS_AT,
        Capacity: capacity,
        Price: 10,
      })
      .expect(201);
    return (response.body as { ConcertId: number }).ConcertId;
  }

  async function reserve(
    concertId: number,
    quantity = 2,
    key = nextKey(),
  ): Promise<ReservationBody> {
    const response = await as(viewerToken, http().post(RESERVATIONS))
      .set('Idempotency-Key', key)
      .send({ ConcertId: concertId, Quantity: quantity })
      .expect(201);
    return response.body as ReservationBody;
  }

  const cancel = (id: number, token = viewerToken) =>
    as(token, http().post(`${RESERVATIONS}/${id}/cancel`));
  const complete = (id: number, token = adminToken) =>
    as(token, http().post(`${RESERVATIONS}/${id}/complete`));

  async function available(concertId: number): Promise<number> {
    const response = await http().get(`${CONCERTS}/${concertId}`).expect(200);
    return (response.body as { Available: number }).Available;
  }

  it('caso 4: cancelar dos veces → 200 las dos; el cupo se libera una sola vez y el pago queda reembolsado', async () => {
    const concertId = await createConcert(10);
    const reservation = await reserve(concertId, 3);
    await expect(available(concertId)).resolves.toBe(7);

    const first = await cancel(reservation.ReservationId).expect(200);
    const second = await cancel(reservation.ReservationId).expect(200);

    expect(first.body).toMatchObject({ Status: 'CANCELLED' });
    expect(second.body).toEqual(first.body);
    await expect(available(concertId)).resolves.toBe(10);
    const payments: Array<{ status: string }> = await app
      .get(DataSource)
      .query('SELECT Status AS status FROM Payment WHERE ReservationId = ?', [
        reservation.ReservationId,
      ]);
    expect(payments).toEqual([{ status: 'REFUNDED' }]);
  });

  it('caso 15: cancelar después de que empezó el concierto → 409', async () => {
    const reservation = await reserve(await createConcert());
    clock.current = AFTER_START;

    await cancel(reservation.ReservationId).expect(409);
  });

  it('caso 16: completar antes de que empiece el concierto → 409', async () => {
    const reservation = await reserve(await createConcert());

    await complete(reservation.ReservationId).expect(409);
  });

  it('caso 23: completar después del concierto → 200 COMPLETED; dos veces → 200 sin cambios', async () => {
    const reservation = await reserve(await createConcert());
    clock.current = AFTER_START;

    const first = await complete(reservation.ReservationId).expect(200);
    const second = await complete(reservation.ReservationId).expect(200);

    expect(first.body).toMatchObject({ Status: 'COMPLETED' });
    expect(second.body).toEqual(first.body);
  });

  it('caso 7: transiciones inválidas alcanzables por HTTP → 409', async () => {
    const concertId = await createConcert();
    const cancelled = await reserve(concertId);
    await cancel(cancelled.ReservationId).expect(200);
    const completed = await reserve(concertId);
    clock.current = AFTER_START;
    await complete(completed.ReservationId).expect(200);

    // CANCELLED → COMPLETED y COMPLETED → CANCELLED.
    const toCompleted = await complete(cancelled.ReservationId).expect(409);
    const toCancelled = await cancel(completed.ReservationId).expect(409);

    expect((toCompleted.body as ErrorBody).detail).toMatch(
      /CANCELLED → COMPLETED/,
    );
    expect((toCancelled.body as ErrorBody).detail).toMatch(
      /COMPLETED → CANCELLED/,
    );
  });

  it('caso 17: un viewer no puede completar → 403', async () => {
    const reservation = await reserve(await createConcert());
    clock.current = AFTER_START;

    await complete(reservation.ReservationId, viewerToken).expect(403);
  });

  it('caso 14: cancelar la reserva de otro usuario → 404 y no cambia', async () => {
    const reservation = await reserve(await createConcert());

    await cancel(reservation.ReservationId, adminToken).expect(404);
    const mine = await as(
      viewerToken,
      http().get(`${RESERVATIONS}/${reservation.ReservationId}`),
    ).expect(200);
    expect((mine.body as ReservationBody).Status).toBe('PAID');
  });

  it('caso 22: reintentar una reserva ya cancelada → 201 con estado CANCELLED, sin cobro nuevo', async () => {
    const concertId = await createConcert();
    const key = nextKey();
    const reservation = await reserve(concertId, 1, key);
    await cancel(reservation.ReservationId).expect(200);
    const charges = gateway.approved.length;

    const retry = await reserve(concertId, 1, key);

    expect(retry).toMatchObject({
      ReservationId: reservation.ReservationId,
      Status: 'CANCELLED',
    });
    expect(gateway.approved.length).toBe(charges);
  });

  it('RF-7: una reserva usa el cupo de una cancelación ya confirmada', async () => {
    const concertId = await createConcert(1);
    const first = await reserve(concertId, 1);
    await as(viewerToken, http().post(RESERVATIONS))
      .set('Idempotency-Key', nextKey())
      .send({ ConcertId: concertId, Quantity: 1 })
      .expect(409);

    await cancel(first.ReservationId).expect(200);

    await reserve(concertId, 1);
  });
});
