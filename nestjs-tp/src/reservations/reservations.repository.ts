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

  findByKey(
    manager: EntityManager,
    userId: number,
    idempotencyKey: string,
  ): Promise<Reservation | null> {
    return manager
      .getRepository(Reservation)
      .findOneBy({ userId, idempotencyKey });
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
    await manager.getRepository(Reservation).update({ id }, { status });
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
      .getRepository(Payment)
      .update({ reservationId }, { status: 'REFUNDED' });
  }

  /** Una reserva; `ownerId` restringe a las del usuario (null = admin: cualquiera). */
  findById(
    id: number,
    ownerId: number | null,
    manager?: EntityManager,
  ): Promise<Reservation | null> {
    const repository = manager?.getRepository(Reservation) ?? this.reservations;
    return repository.findOneBy(
      ownerId === null ? { id } : { id, userId: ownerId },
    );
  }

  /** Página de reservas por id; `ownerId` null = todas (admin). */
  findPage(
    ownerId: number | null,
    skip: number,
    limit: number,
  ): Promise<Reservation[]> {
    return this.reservations.find({
      where: ownerId === null ? {} : { userId: ownerId },
      order: { id: 'ASC' },
      skip,
      take: limit,
    });
  }
}
