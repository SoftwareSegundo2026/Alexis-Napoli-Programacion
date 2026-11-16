import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { TransactionLock } from '../src/database/transaction-lock.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import {
  ControllablePaymentGateway,
  FakeClock,
  withDoubles,
} from './helpers/reservations-doubles.js';
import { createTestApp } from './helpers/test-app.js';

interface ReservationBody {
  ReservationId: number;
}

const RESERVATIONS = '/api/v1/reservations';
const CONCERTS = '/api/v1/concerts';

/** Cede el turno al event loop: NO es una espera por tiempo. */
const yieldTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Espera a que se cumpla una CONDICIÓN cediendo el turno (sin tiempos fijos). El
 * tope de vueltas solo evita colgar la suite si algo anda mal.
 */
async function until(condition: () => boolean, what: string): Promise<void> {
  for (let turn = 0; turn < 100_000; turn += 1) {
    if (condition()) return;
    await yieldTurn();
  }
  throw new Error(`Nunca se cumplió: ${what}`);
}

/**
 * Concurrencia (spec 004 RF-6, RF-7, RF-13; casos 1, 8, 13, 21), SIN `sleep`
 * (RNF-2). El pago de prueba se detiene en una BARRERA que controla el test:
 * así la reserva A queda a mitad de su transacción mientras llega B.
 */
describe('Reservas concurrentes (e2e, spec 004)', () => {
  let app: INestApplication<App>;
  let lock: TransactionLock;
  const gateway = new ControllablePaymentGateway();
  let viewerToken = '';
  let adminToken = '';
  let keyCounter = 0;

  beforeAll(async () => {
    app = await createTestApp(withDoubles(gateway, new FakeClock()));
    const users = await seedTestUsers(app);
    viewerToken = users.viewerToken;
    adminToken = users.adminToken;
    lock = app.get(TransactionLock);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    gateway.pause = undefined;
  });

  const http = () => request(app.getHttpServer());
  const nextKey = () => `clave-conc-${++keyCounter}`;

  async function createConcert(capacity: number): Promise<number> {
    const response = await http()
      .post(CONCERTS)
      .set('Authorization', bearer(adminToken))
      .send({
        ArtistId: 1,
        Title: `Concurrencia ${++keyCounter}`,
        StartsAt: '2099-06-01T21:00:00Z',
        Capacity: capacity,
        Price: 10,
      })
      .expect(201);
    return (response.body as { ConcertId: number }).ConcertId;
  }

  const reserve = (concertId: number, key = nextKey(), quantity = 1) =>
    http()
      .post(RESERVATIONS)
      .set('Authorization', bearer(viewerToken))
      .set('Idempotency-Key', key)
      .send({ ConcertId: concertId, Quantity: quantity });

  async function available(concertId: number): Promise<number> {
    const response = await http().get(`${CONCERTS}/${concertId}`).expect(200);
    return (response.body as { Available: number }).Available;
  }

  /** Barrera: cada cobro entra, se cuenta y espera a que el test la libere. */
  function installBarrier() {
    let entered = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    gateway.pause = async () => {
      entered += 1;
      await gate;
    };
    return { entered: () => entered, release };
  }

  it('caso 1: dos reservas simultáneas por la última entrada → una 201 y la otra 409, nunca ambas', async () => {
    const concertId = await createConcert(1);
    const charges = gateway.approved.length;
    const barrier = installBarrier();

    const a = reserve(concertId).then((r) => r);
    await until(() => barrier.entered() === 1, 'A está cobrando');
    const b = reserve(concertId).then((r) => r);
    // B queda en la cola del candado... o, si no hubiera candado, cobrando también.
    await until(
      () => lock.pending === 2 || barrier.entered() === 2,
      'B llegó al candado o al cobro',
    );
    barrier.release();
    const statuses = (await Promise.all([a, b]))
      .map((r) => r.status)
      .sort((x, y) => x - y);

    expect(statuses).toEqual([201, 409]);
    expect(gateway.approved.length).toBe(charges + 1);
    await expect(available(concertId)).resolves.toBe(0);
  });

  it('caso 13: muchas reservas simultáneas → se vende exactamente la capacidad', async () => {
    const capacity = 5;
    const concertId = await createConcert(capacity);
    const charges = gateway.approved.length;
    gateway.pause = yieldTurn; // cada cobro cede el turno: los pedidos se entremezclan

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => reserve(concertId)),
    );
    const created = responses.filter((r) => r.status === 201).length;
    const rejected = responses.filter((r) => r.status === 409).length;

    expect(created).toBe(capacity);
    expect(rejected).toBe(12 - capacity);
    expect(gateway.approved.length).toBe(charges + capacity);
    await expect(available(concertId)).resolves.toBe(0);
  });

  it('caso 21: dos pedidos simultáneos con la misma clave → una reserva y un cobro', async () => {
    const concertId = await createConcert(10);
    const charges = gateway.approved.length;
    const key = nextKey();
    const barrier = installBarrier();

    const a = reserve(concertId, key).then((r) => r);
    await until(() => barrier.entered() === 1, 'A está cobrando');
    const b = reserve(concertId, key).then((r) => r);
    await until(
      () => lock.pending === 2 || barrier.entered() === 2,
      'B llegó al candado o al cobro',
    );
    barrier.release();
    const [first, second] = await Promise.all([a, b]);

    expect([first.status, second.status]).toEqual([201, 201]);
    expect((second.body as ReservationBody).ReservationId).toBe(
      (first.body as ReservationBody).ReservationId,
    );
    expect(gateway.approved.length).toBe(charges + 1);
    await expect(available(concertId)).resolves.toBe(9);
  });

  it('caso 8: la disponibilidad consultada durante una reserva en curso es la confirmada', async () => {
    const concertId = await createConcert(4);
    const barrier = installBarrier();

    const pending = reserve(concertId, nextKey(), 3).then((r) => r);
    await until(() => barrier.entered() === 1, 'la reserva está cobrando');

    // Transacción abierta: la reserva existe como PENDING, pero no cuenta.
    await expect(available(concertId)).resolves.toBe(4);

    barrier.release();
    expect((await pending).status).toBe(201);
    await expect(available(concertId)).resolves.toBe(1);
  });
});
