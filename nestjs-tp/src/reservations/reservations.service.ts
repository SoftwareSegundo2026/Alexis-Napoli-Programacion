import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { ConcertsRepository } from '../concerts/concerts.repository.js';
import { Clock } from '../database/clock.js';
import { TransactionLock } from '../database/transaction-lock.js';
import type { User } from '../users/entities/user.entity.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { Reservation } from './entities/reservation.entity.js';
import {
  PAYMENT_GATEWAY,
  PaymentRejectedError,
  type PaymentGateway,
} from './payment-gateway.js';
import { assertTransition } from './reservation-status.js';
import { ReservationsRepository } from './reservations.repository.js';

/** Importe en centavos exactos (evita 0.1 × 3 = 0.30000000000000004). */
const toMoney = (value: number): number => Math.round(value * 100) / 100;

/** Reglas de reservas (spec 004). */
@Injectable()
export class ReservationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly lock: TransactionLock,
    private readonly clock: Clock,
    private readonly reservations: ReservationsRepository,
    private readonly concerts: ConcertsRepository,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  /**
   * Reserva y paga en UNA transacción (RF-4, RNF-1), dentro del candado que
   * serializa las transacciones de reservas (RF-7: nadie lee la disponibilidad
   * mientras otro está reservando). Cualquier excepción adentro → rollback de
   * todo: ni reserva ni pago (RF-5).
   */
  create(
    user: User,
    dto: CreateReservationDto,
    idempotencyKey: string,
  ): Promise<Reservation> {
    return this.lock.run(() =>
      this.dataSource.transaction(async (manager) => {
        // RF-6: misma clave del mismo usuario → la misma reserva, sin cobrar.
        const previous = await this.reservations.findByKey(
          manager,
          user.id,
          idempotencyKey,
        );
        if (previous !== null) {
          if (
            previous.concertId !== dto.ConcertId ||
            previous.quantity !== dto.Quantity
          ) {
            throw new ConflictException(
              'Idempotency-Key was already used with a different request',
            );
          }
          return previous;
        }

        const found = await this.concerts.findById(dto.ConcertId, manager);
        if (found === null) {
          throw new NotFoundException('Concert not found');
        }
        const { concert, available } = found;
        if (
          new Date(concert.startsAt).getTime() <= this.clock.now().getTime()
        ) {
          throw new BadRequestException('The concert has already started');
        }
        if (dto.Quantity > available) {
          throw new ConflictException(`Only ${available} seat(s) left`);
        }

        const now = this.clock.now().toISOString();
        const amount = toMoney(dto.Quantity * concert.price);
        const reservation = await this.reservations.insert(manager, {
          concertId: concert.id,
          userId: user.id,
          quantity: dto.Quantity,
          amount,
          status: 'PENDING',
          idempotencyKey,
          createdAt: now,
        });

        try {
          await this.gateway.charge({ reservationId: reservation.id, amount });
        } catch (error) {
          if (error instanceof PaymentRejectedError) {
            throw new HttpException(
              `Pago rechazado: ${error.message}`,
              HttpStatus.PAYMENT_REQUIRED,
            );
          }
          throw error; // falla inesperada → 500, y el mismo rollback
        }

        await this.reservations.insertPayment(manager, {
          reservationId: reservation.id,
          amount,
          status: 'APPROVED',
          createdAt: now,
        });
        assertTransition(reservation.status, 'PAID');
        await this.reservations.updateStatus(manager, reservation.id, 'PAID');
        reservation.status = 'PAID';
        return reservation;
      }),
    );
  }

  /**
   * Cancela una reserva PROPIA (RF-9): en una transacción la pasa a CANCELLED,
   * reembolsa el pago y libera sus entradas (la disponibilidad se recalcula).
   * Cancelar una ya cancelada → la misma reserva, sin cambios (idempotente).
   */
  cancel(user: User, id: number): Promise<Reservation> {
    return this.lock.run(() =>
      this.dataSource.transaction(async (manager) => {
        // Solo el dueño: la de otro (incluso para el admin) → 404 (RF-12).
        const reservation = await this.reservations.findById(
          id,
          user.id,
          manager,
        );
        if (reservation === null) {
          throw new NotFoundException('Reservation not found');
        }
        if (reservation.status === 'CANCELLED') {
          return reservation;
        }
        assertTransition(reservation.status, 'CANCELLED'); // COMPLETED → 409
        if (await this.hasStarted(reservation.concertId, manager)) {
          throw new ConflictException('The concert has already started');
        }
        await this.reservations.updateStatus(
          manager,
          reservation.id,
          'CANCELLED',
        );
        await this.reservations.refundPayment(manager, reservation.id);
        reservation.status = 'CANCELLED';
        return reservation;
      }),
    );
  }

  /**
   * Completa una reserva (admin, RF-10) cuando el concierto ya empezó.
   * Completar una ya completada → la misma reserva, sin cambios (idempotente).
   */
  complete(id: number): Promise<Reservation> {
    return this.lock.run(() =>
      this.dataSource.transaction(async (manager) => {
        const reservation = await this.reservations.findById(id, null, manager);
        if (reservation === null) {
          throw new NotFoundException('Reservation not found');
        }
        if (reservation.status === 'COMPLETED') {
          return reservation;
        }
        assertTransition(reservation.status, 'COMPLETED'); // CANCELLED → 409
        if (!(await this.hasStarted(reservation.concertId, manager))) {
          throw new ConflictException('The concert has not started yet');
        }
        await this.reservations.updateStatus(
          manager,
          reservation.id,
          'COMPLETED',
        );
        reservation.status = 'COMPLETED';
        return reservation;
      }),
    );
  }

  findAll(
    user: User,
    { skip, limit }: PaginationQueryDto,
  ): Promise<Reservation[]> {
    return this.reservations.findPage(this.ownerFilter(user), skip, limit);
  }

  /** RF-12: la reserva de otro usuario responde 404 (no revela que existe). */
  async findOne(user: User, id: number): Promise<Reservation> {
    const reservation = await this.reservations.findById(
      id,
      this.ownerFilter(user),
    );
    if (reservation === null) {
      throw new NotFoundException('Reservation not found');
    }
    return reservation;
  }

  /** ¿El concierto ya empezó según el reloj? (Clock inyectable: los tests lo adelantan.) */
  private async hasStarted(
    concertId: number,
    manager: EntityManager,
  ): Promise<boolean> {
    const found = await this.concerts.findById(concertId, manager);
    return (
      found !== null &&
      new Date(found.concert.startsAt).getTime() <= this.clock.now().getTime()
    );
  }

  /** El admin ve todas; cualquier otro usuario, solo las suyas. */
  private ownerFilter(user: User): number | null {
    return user.isAdmin ? null : user.id;
  }
}
