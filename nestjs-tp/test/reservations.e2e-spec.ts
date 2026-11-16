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
  ConcertId: number;
  Quantity: number;
  Amount: number;
  Status: string;
  CreatedAt: string;
}

interface ConcertBody {
  ConcertId: number;
  Available: number;
}

interface ErrorBody {
  detail: string;
}

const RESERVATIONS = '/api/v1/reservations';
const CONCERTS = '/api/v1/concerts';

/** Alta atómica de reservas y consultas (spec 004 RF-3–RF-6, RF-8, RF-12). */
describe('Reservas (e2e, spec 004)', () => {
  let app: INestApplication<App>;
  const gateway = new ControllablePaymentGateway();
  const clock = new FakeClock();
  let adminToken = '';
  let viewerToken = '';
  let keyCounter = 0;

  beforeAll(async () => {
    app = await createTestApp(withDoubles(gateway, clock));
    const users = await seedTestUsers(app);
    adminToken = users.adminToken;
    viewerToken = users.viewerToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    gateway.mode = 'approve';
    clock.current = new Date();
  });

  const http = () => request(app.getHttpServer());
  const nextKey = () => `clave-e2e-${++keyCounter}`;

  async function createConcert(capacity = 10, price = 20): Promise<number> {
    const response = await http()
      .post(CONCERTS)
      .set('Authorization', bearer(adminToken))
      .send({
        ArtistId: 1,
        Title: `Concierto reservas ${keyCounter}-${Math.random()}`,
        StartsAt: '2099-06-01T21:00:00Z',
        Capacity: capacity,
        Price: price,
      })
      .expect(201);
    return (response.body as ConcertBody).ConcertId;
  }

  // `null` = sin header. (Con `undefined` se aplicaría el valor por defecto.)
  const reserve = (
    body: object,
    key: string | null = nextKey(),
    token = viewerToken,
  ) => {
    const test = http().post(RESERVATIONS).set('Authorization', bearer(token));
    return (key === null ? test : test.set('Idempotency-Key', key)).send(body);
  };

  async function available(concertId: number): Promise<number> {
    const response = await http().get(`${CONCERTS}/${concertId}`).expect(200);
    return (response.body as ConcertBody).Available;
  }

  async function countRows(): Promise<{
    reservations: number;
    payments: number;
  }> {
    const dataSource = app.get(DataSource);
    const [r]: Array<{ total: number }> = await dataSource.query(
      'SELECT COUNT(*) AS total FROM Reservation',
    );
    const [p]: Array<{ total: number }> = await dataSource.query(
      'SELECT COUNT(*) AS total FROM Payment',
    );
    return { reservations: r.total, payments: p.total };
  }

  it('reserva y paga en una sola operación → 201 PAID con el importe (RF-4)', async () => {
    const concertId = await createConcert(10, 20.5);

    const response = await reserve({
      ConcertId: concertId,
      Quantity: 3,
    }).expect(201);

    expect(response.body).toEqual({
      ReservationId: expect.any(Number) as number,
      ConcertId: concertId,
      Quantity: 3,
      Amount: 61.5,
      Status: 'PAID',
      CreatedAt: expect.any(String) as string,
    });
    await expect(available(concertId)).resolves.toBe(7);
  });

  it('caso 2: el pago se rechaza → 402 y rollback: sin reserva, sin pago, cupo igual', async () => {
    const concertId = await createConcert(5);
    const before = await countRows();
    gateway.mode = 'reject';

    const response = await reserve({
      ConcertId: concertId,
      Quantity: 2,
    }).expect(402);

    expect((response.body as ErrorBody).detail).toMatch(/rechazado/);
    await expect(countRows()).resolves.toEqual(before);
    await expect(available(concertId)).resolves.toBe(5);
  });

  it('caso 20: el pago falla de forma inesperada → 500 y el mismo rollback', async () => {
    const concertId = await createConcert(5);
    const before = await countRows();
    gateway.mode = 'error';

    await reserve({ ConcertId: concertId, Quantity: 2 }).expect(500);

    await expect(countRows()).resolves.toEqual(before);
    await expect(available(concertId)).resolves.toBe(5);
  });

  it('caso 3: reintento con la misma clave y cuerpo → misma reserva, un solo cobro', async () => {
    const concertId = await createConcert(10);
    const key = nextKey();
    const charges = gateway.approved.length;

    const first = await reserve(
      { ConcertId: concertId, Quantity: 2 },
      key,
    ).expect(201);
    const retry = await reserve(
      { ConcertId: concertId, Quantity: 2 },
      key,
    ).expect(201);

    expect(retry.body).toEqual(first.body);
    expect(gateway.approved.length).toBe(charges + 1);
    await expect(available(concertId)).resolves.toBe(8);
  });

  it('un intento rechazado no gasta la clave: el reintento aprobado reserva (RF-6)', async () => {
    const concertId = await createConcert(10);
    const key = nextKey();
    gateway.mode = 'reject';
    await reserve({ ConcertId: concertId, Quantity: 1 }, key).expect(402);

    gateway.mode = 'approve';
    await reserve({ ConcertId: concertId, Quantity: 1 }, key).expect(201);
  });

  it('caso 11: misma clave con otro cuerpo → 409', async () => {
    const concertId = await createConcert(10);
    const key = nextKey();
    await reserve({ ConcertId: concertId, Quantity: 1 }, key).expect(201);

    await reserve({ ConcertId: concertId, Quantity: 2 }, key).expect(409);
  });

  it('caso 12: la misma clave de OTRO usuario es una reserva independiente', async () => {
    const concertId = await createConcert(10);
    const key = nextKey();

    const mine = await reserve(
      { ConcertId: concertId, Quantity: 1 },
      key,
    ).expect(201);
    const theirs = await reserve(
      { ConcertId: concertId, Quantity: 1 },
      key,
      adminToken,
    ).expect(201);

    expect((theirs.body as ReservationBody).ReservationId).not.toBe(
      (mine.body as ReservationBody).ReservationId,
    );
  });

  it('caso 5: el concierto ya empezó → 400 y no cobra', async () => {
    const concertId = await createConcert(10);
    clock.current = new Date('2099-06-01T21:00:00Z');
    const charges = gateway.approved.length;

    await reserve({ ConcertId: concertId, Quantity: 1 }).expect(400);

    expect(gateway.approved.length).toBe(charges);
  });

  it('caso 6: más entradas que las disponibles → 409 con las que quedan', async () => {
    const concertId = await createConcert(3);
    await reserve({ ConcertId: concertId, Quantity: 2 }).expect(201);

    const response = await reserve({
      ConcertId: concertId,
      Quantity: 2,
    }).expect(409);

    expect((response.body as ErrorBody).detail).toMatch(
      /Only 1 seat\(s\) left/,
    );
  });

  it('caso 18: concierto inexistente → 404', async () => {
    await reserve({ ConcertId: 999999, Quantity: 1 }).expect(404);
  });

  it('caso 9: Status en el cuerpo → 400 (el estado nunca lo manda el cliente)', async () => {
    const concertId = await createConcert(10);

    const response = await reserve({
      ConcertId: concertId,
      Quantity: 1,
      Status: 'PAID',
    }).expect(400);

    expect((response.body as ErrorBody).detail).toMatch(/Status/);
  });

  it.each([null, 'corta'])('caso 10: Idempotency-Key %j → 400', async (key) => {
    const concertId = await createConcert(10);

    const response = await reserve(
      { ConcertId: concertId, Quantity: 1 },
      key,
    ).expect(400);

    expect((response.body as ErrorBody).detail).toMatch(/Idempotency-Key/);
  });

  it.each([0, 11, 1.5])('caso 19: Quantity=%s → 400', async (Quantity) => {
    const concertId = await createConcert(10);

    await reserve({ ConcertId: concertId, Quantity }).expect(400);
  });

  it('caso 25: concierto gratis → PAID con importe 0 y un pago de 0', async () => {
    const concertId = await createConcert(10, 0);

    const response = await reserve({
      ConcertId: concertId,
      Quantity: 2,
    }).expect(201);

    expect(response.body).toMatchObject({ Status: 'PAID', Amount: 0 });
    expect(gateway.approved.at(-1)).toMatchObject({ amount: 0 });
  });

  it('sin credencial → 401', async () => {
    await http()
      .post(RESERVATIONS)
      .set('Idempotency-Key', nextKey())
      .send({ ConcertId: 1, Quantity: 1 })
      .expect(401);
  });

  describe('consultas (RF-12)', () => {
    it('cada usuario ve solo sus reservas; el admin ve todas', async () => {
      const concertId = await createConcert(10);
      const mine = (
        await reserve({ ConcertId: concertId, Quantity: 1 }).expect(201)
      ).body as ReservationBody;
      const admins = (
        await reserve(
          { ConcertId: concertId, Quantity: 1 },
          nextKey(),
          adminToken,
        ).expect(201)
      ).body as ReservationBody;

      const viewerList = (
        await http()
          .get(RESERVATIONS)
          .set('Authorization', bearer(viewerToken))
          .expect(200)
      ).body as ReservationBody[];
      const adminList = (
        await http()
          .get(RESERVATIONS)
          .query({ limit: 100 })
          .set('Authorization', bearer(adminToken))
          .expect(200)
      ).body as ReservationBody[];

      const viewerIds = viewerList.map((r) => r.ReservationId);
      expect(viewerIds).toContain(mine.ReservationId);
      expect(viewerIds).not.toContain(admins.ReservationId);
      expect(adminList.map((r) => r.ReservationId)).toEqual(
        expect.arrayContaining([mine.ReservationId, admins.ReservationId]),
      );
    });

    it('caso 14: la reserva de otro usuario → 404; la propia → 200; el admin la ve', async () => {
      const concertId = await createConcert(10);
      const admins = (
        await reserve(
          { ConcertId: concertId, Quantity: 1 },
          nextKey(),
          adminToken,
        ).expect(201)
      ).body as ReservationBody;
      const mine = (
        await reserve({ ConcertId: concertId, Quantity: 1 }).expect(201)
      ).body as ReservationBody;

      await http()
        .get(`${RESERVATIONS}/${admins.ReservationId}`)
        .set('Authorization', bearer(viewerToken))
        .expect(404);
      await http()
        .get(`${RESERVATIONS}/${mine.ReservationId}`)
        .set('Authorization', bearer(viewerToken))
        .expect(200);
      await http()
        .get(`${RESERVATIONS}/${mine.ReservationId}`)
        .set('Authorization', bearer(adminToken))
        .expect(200);
    });
  });
});
