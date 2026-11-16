import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Artist } from '../artists/entities/artist.entity.js';
import { ConcertsRepository } from '../concerts/concerts.repository.js';
import { Concert } from '../concerts/entities/concert.entity.js';
import { Clock } from '../database/clock.js';
import { TEMPLATE_DATABASE_PATH } from '../database/database.module.js';
import { prepareConnection } from '../database/prepare-connection.js';
import { TransactionLock } from '../database/transaction-lock.js';
import { User } from '../users/entities/user.entity.js';
import { Payment } from './entities/payment.entity.js';
import { Reservation } from './entities/reservation.entity.js';
import {
  PaymentRejectedError,
  type ChargeRequest,
  type PaymentGateway,
} from './payment-gateway.js';
import { ReservationsRepository } from './reservations.repository.js';
import { ReservationsService } from './reservations.service.js';
import { ReservationResponseDto } from './dto/reservation-response.dto.js';

/** Medio de pago del test: aprueba, rechaza o falla según `mode`. */
class TestGateway implements PaymentGateway {
  mode: 'approve' | 'reject' | 'error' = 'approve';
  readonly charges: ChargeRequest[] = [];
  charge(request: ChargeRequest): Promise<void> {
    if (this.mode === 'reject') {
      return Promise.reject(new PaymentRejectedError('sin fondos'));
    }
    if (this.mode === 'error') {
      return Promise.reject(new Error('caída'));
    }
    this.charges.push(request);
    return Promise.resolve();
  }
}

class TestClock extends Clock {
  current = new Date('2030-01-01T00:00:00Z');
  override now(): Date {
    return new Date(this.current.getTime());
  }
}

/**
 * Reserva atómica (spec 004 RF-4–RF-6, RF-8, RF-12) contra una copia REAL de la
 * base: la transacción, el rollback y la idempotencia son de la base de verdad.
 */
describe('ReservationsService (contra una copia de la base)', () => {
  const databasePath = join(tmpdir(), `reservations-${randomUUID()}.db`);
  const gateway = new TestGateway();
  const clock = new TestClock();
  let dataSource: DataSource;
  let service: ReservationsService;
  let concerts: ConcertsRepository;
  let owner: User;
  let other: User;
  let admin: User;
  let key = 0;
  const nextKey = () => `clave-unit-${++key}`;

  beforeAll(async () => {
    copyFileSync(TEMPLATE_DATABASE_PATH, databasePath);
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: databasePath,
      entities: [Concert, Artist, Reservation, Payment],
      prepareDatabase: prepareConnection,
    });
    await dataSource.initialize();
    concerts = new ConcertsRepository(dataSource.getRepository(Concert));
    service = new ReservationsService(
      dataSource,
      new TransactionLock(),
      clock,
      new ReservationsRepository(dataSource.getRepository(Reservation)),
      concerts,
      gateway,
    );
    const ids: Array<{ id: number }> = await dataSource.query(
      'SELECT UserId AS id FROM User ORDER BY UserId LIMIT 1',
    );
    // Dos usuarios más (las claves foráneas se hacen cumplir).
    await dataSource.query(
      "INSERT INTO User (Username, Email, FullName, Disabled, IsAdmin, HashedPassword) VALUES ('unit_a', 'unit_a@example.com', NULL, 0, 0, 'x'), ('unit_b', 'unit_b@example.com', NULL, 0, 1, 'x')",
    );
    const more: Array<{ id: number }> = await dataSource.query(
      "SELECT UserId AS id FROM User WHERE Username IN ('unit_a', 'unit_b') ORDER BY Username",
    );
    owner = Object.assign(new User(), { id: ids[0].id, isAdmin: false });
    other = Object.assign(new User(), { id: more[0].id, isAdmin: false });
    admin = Object.assign(new User(), { id: more[1].id, isAdmin: true });
  });

  afterAll(async () => {
    await dataSource.destroy();
    rmSync(databasePath, { force: true });
  });

  beforeEach(() => {
    gateway.mode = 'approve';
    clock.current = new Date('2030-01-01T00:00:00Z');
  });

  const newConcert = async (capacity = 10, price = 12.5) =>
    (
      await concerts.create({
        artistId: 1,
        title: `Unit ${nextKey()}`,
        startsAt: '2031-01-01T00:00:00.000Z',
        capacity,
        price,
      })
    ).concert.id;

  const rows = async () => {
    const [r]: Array<{ total: number }> = await dataSource.query(
      'SELECT COUNT(*) AS total FROM Reservation',
    );
    const [p]: Array<{ total: number }> = await dataSource.query(
      'SELECT COUNT(*) AS total FROM Payment',
    );
    return { reservations: r.total, payments: p.total };
  };

  it('reserva PAID con importe = cantidad × precio y un pago APPROVED', async () => {
    const concertId = await newConcert(10, 12.5);

    const reservation = await service.create(
      owner,
      { ConcertId: concertId, Quantity: 3 },
      nextKey(),
    );

    expect(reservation).toMatchObject({
      status: 'PAID',
      amount: 37.5,
      quantity: 3,
    });
    const payments: Array<{ status: string; amount: number }> =
      await dataSource.query(
        'SELECT Status AS status, Amount AS amount FROM Payment WHERE ReservationId = ?',
        [reservation.id],
      );
    expect(payments).toEqual([{ status: 'APPROVED', amount: 37.5 }]);
  });

  it.each<['reject' | 'error', new (...args: never[]) => Error]>([
    ['reject', HttpException],
    ['error', Error],
  ])('pago %s → excepción y rollback completo', async (mode, errorType) => {
    const concertId = await newConcert();
    const before = await rows();
    gateway.mode = mode;

    await expect(
      service.create(owner, { ConcertId: concertId, Quantity: 1 }, nextKey()),
    ).rejects.toBeInstanceOf(errorType);
    await expect(rows()).resolves.toEqual(before);
  });

  it('pago rechazado → 402', async () => {
    const concertId = await newConcert();
    gateway.mode = 'reject';

    const error: unknown = await service
      .create(owner, { ConcertId: concertId, Quantity: 1 }, nextKey())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(HttpException);
    expect(error instanceof HttpException && error.getStatus()).toBe(402);
  });

  it('misma clave y cuerpo → la misma reserva; otro cuerpo → 409', async () => {
    const concertId = await newConcert();
    const k = nextKey();
    const charges = gateway.charges.length;

    const first = await service.create(
      owner,
      { ConcertId: concertId, Quantity: 1 },
      k,
    );
    const again = await service.create(
      owner,
      { ConcertId: concertId, Quantity: 1 },
      k,
    );

    expect(again.id).toBe(first.id);
    expect(gateway.charges.length).toBe(charges + 1);
    await expect(
      service.create(owner, { ConcertId: concertId, Quantity: 2 }, k),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('concierto inexistente → 404; ya empezado → 400; sin cupo → 409 con las que quedan', async () => {
    const concertId = await newConcert(2);
    await expect(
      service.create(owner, { ConcertId: 999999, Quantity: 1 }, nextKey()),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.create(owner, { ConcertId: concertId, Quantity: 3 }, nextKey()),
    ).rejects.toThrow('Only 2 seat(s) left');

    clock.current = new Date('2031-01-01T00:00:00Z');
    await expect(
      service.create(owner, { ConcertId: concertId, Quantity: 1 }, nextKey()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consultas: el dueño ve las suyas, otro usuario recibe 404, el admin ve todas (RF-12)', async () => {
    const concertId = await newConcert();
    const mine = await service.create(
      owner,
      { ConcertId: concertId, Quantity: 1 },
      nextKey(),
    );

    await expect(service.findOne(owner, mine.id)).resolves.toMatchObject({
      id: mine.id,
    });
    await expect(service.findOne(other, mine.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOne(admin, mine.id)).resolves.toMatchObject({
      id: mine.id,
    });
    const ownList = await service.findAll(owner, { skip: 0, limit: 100 });
    const otherList = await service.findAll(other, { skip: 0, limit: 100 });
    const adminList = await service.findAll(admin, { skip: 0, limit: 100 });
    expect(ownList.map((r) => r.id)).toContain(mine.id);
    expect(otherList.map((r) => r.id)).not.toContain(mine.id);
    expect(adminList.map((r) => r.id)).toContain(mine.id);
  });

  it('el DTO de respuesta no expone el usuario ni el pago', async () => {
    const concertId = await newConcert();
    const reservation = await service.create(
      owner,
      { ConcertId: concertId, Quantity: 1 },
      nextKey(),
    );

    expect(
      Object.keys(ReservationResponseDto.fromEntity(reservation)).sort(),
    ).toEqual([
      'Amount',
      'ConcertId',
      'CreatedAt',
      'Quantity',
      'ReservationId',
      'Status',
    ]);
  });

  describe('cancelar y completar (RF-9, RF-10, RF-11)', () => {
    const AFTER = new Date('2031-01-02T00:00:00Z');
    const reserveOne = async (quantity = 2) =>
      service.create(
        owner,
        { ConcertId: await newConcert(5), Quantity: quantity },
        nextKey(),
      );
    const available = async (concertId: number) =>
      (await concerts.findById(concertId))?.available;

    it('cancelar: CANCELLED, pago REFUNDED y cupo liberado; dos veces → igual', async () => {
      const reservation = await reserveOne(2);
      await expect(available(reservation.concertId)).resolves.toBe(3);

      const first = await service.cancel(owner, reservation.id);
      const second = await service.cancel(owner, reservation.id);

      expect(first.status).toBe('CANCELLED');
      expect(second).toEqual(first);
      await expect(available(reservation.concertId)).resolves.toBe(5);
      const payments: Array<{ status: string }> = await dataSource.query(
        'SELECT Status AS status FROM Payment WHERE ReservationId = ?',
        [reservation.id],
      );
      expect(payments).toEqual([{ status: 'REFUNDED' }]);
    });

    it('cancelar: de otro usuario → 404; inexistente → 404; ya empezado → 409', async () => {
      const reservation = await reserveOne();

      await expect(
        service.cancel(other, reservation.id),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.cancel(owner, 999999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      clock.current = AFTER;
      await expect(service.cancel(owner, reservation.id)).rejects.toThrow(
        'The concert has already started',
      );
    });

    it('completar: antes del concierto → 409; después → COMPLETED; dos veces → igual', async () => {
      const reservation = await reserveOne();

      await expect(service.complete(reservation.id)).rejects.toThrow(
        'The concert has not started yet',
      );
      clock.current = AFTER;
      const first = await service.complete(reservation.id);
      const second = await service.complete(reservation.id);

      expect(first.status).toBe('COMPLETED');
      expect(second).toEqual(first);
      await expect(service.complete(999999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('transiciones inválidas: cancelar una completada y completar una cancelada → 409', async () => {
      const cancelled = await reserveOne();
      await service.cancel(owner, cancelled.id);
      const completed = await reserveOne();
      clock.current = AFTER;
      await service.complete(completed.id);

      await expect(service.complete(cancelled.id)).rejects.toThrow(
        'Invalid status transition: CANCELLED → COMPLETED',
      );
      await expect(service.cancel(owner, completed.id)).rejects.toThrow(
        'Invalid status transition: COMPLETED → CANCELLED',
      );
    });
  });
});
