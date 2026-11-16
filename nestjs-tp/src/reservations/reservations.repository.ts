import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity.js';
import { Reservation } from './entities/reservation.entity.js';
import type { ReservationStatus } from './reservation-status.js';

/** Datos de una reserva nueva (sin id). */
export type NewReservation = Omit<Reservation, 'id'>;
/** Datos de un pago nuevo (sin id). */
export type NewPayment = Omit<Payment, 'id'>;

/**
 * DAO de reservas y pagos. Los métodos que escriben reciben el `EntityManager`
 * de la transacción en curso: así la reserva y su pago van en LA MISMA
 * transacción (spec 004 RNF-1).
 */
@Injectable()
export class ReservationsRepository {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservations: Repository<Reservation>,
  ) {}

  // Spec 004 RNF-5 (como la 003 RNF-3): el driver de SQLite de TypeORM escribe
  // como LITERAL todo parámetro `number` (`findOneBy({ id })` → `"Id" = 5`). Por
  // eso los ids van como texto con `CAST(? AS INTEGER)`: así viajan como `?`.

  findByKey(
    manager: EntityManager,
    userId: number,
    idempotencyKey: string,
  ): Promise<Reservation | null> {
    return manager
      .getRepository(Reservation)
      .createQueryBuilder('reservation')
      .where('reservation.userId = CAST(:userId AS INTEGER)', {
        userId: String(userId),
      })
      .andWhere('reservation.idempotencyKey = :idempotencyKey', {
        idempotencyKey,
      })
      .getOne();
  }

  insert(manager: EntityManager, data: NewReservation): Promise<Reservation> {
    const repository = manager.getRepository(Reservation);
    return repository.save(repository.create(data));
  }

  async updateStatus(
    manager: EntityManager,
    id: number,
    status: ReservationStatus,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Reservation)
      .set({ status })
      .where('"ReservationId" = CAST(:id AS INTEGER)', { id: String(id) })
      .execute();
  }

  async insertPayment(manager: EntityManager, data: NewPayment): Promise<void> {
    const repository = manager.getRepository(Payment);
    await repository.save(repository.create(data));
  }

  async refundPayment(
    manager: EntityManager,
    reservationId: number,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(Payment)
      .set({ status: 'REFUNDED' })
      .where('"ReservationId" = CAST(:reservationId AS INTEGER)', {
        reservationId: String(reservationId),
      })
      .execute();
  }

  /** Una reserva; `ownerId` restringe a las del usuario (null = admin: cualquiera). */
  findById(
    id: number,
    ownerId: number | null,
    manager?: EntityManager,
  ): Promise<Reservation | null> {
    const repository = manager?.getRepository(Reservation) ?? this.reservations;
    const query = repository
      .createQueryBuilder('reservation')
      .where('reservation.id = CAST(:id AS INTEGER)', { id: String(id) });
    if (ownerId !== null) {
      query.andWhere('reservation.userId = CAST(:ownerId AS INTEGER)', {
        ownerId: String(ownerId),
      });
    }
    return query.getOne();
  }

  /** Página de reservas por id; `ownerId` null = todas (admin). */
  findPage(
    ownerId: number | null,
    skip: number,
    limit: number,
  ): Promise<Reservation[]> {
    const query = this.reservations.createQueryBuilder('reservation');
    if (ownerId !== null) {
      query.where('reservation.userId = CAST(:ownerId AS INTEGER)', {
        ownerId: String(ownerId),
      });
    }
    // LIMIT/OFFSET los escribe el QueryBuilder (enteros validados, spec 003).
    return query
      .orderBy('reservation.id', 'ASC')
      .offset(skip)
      .limit(limit)
      .getMany();
  }
}
