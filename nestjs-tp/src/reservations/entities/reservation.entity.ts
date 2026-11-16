import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  type ValueTransformer,
} from 'typeorm';
import type { ReservationStatus } from '../reservation-status.js';

/** NUMERIC(10,2) → número JSON al leer. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | number | null): number | null =>
    value === null ? null : Number(value),
};

/** Tabla `Reservation` (migración de la spec 004). */
@Entity({ name: 'Reservation' })
export class Reservation {
  @PrimaryGeneratedColumn({ name: 'ReservationId' })
  id: number;

  @Column({ name: 'ConcertId', type: 'integer' })
  concertId: number;

  @Column({ name: 'UserId', type: 'integer' })
  userId: number;

  @Column({ name: 'Quantity', type: 'integer' })
  quantity: number;

  @Column({
    name: 'Amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ name: 'Status', type: 'text' })
  status: ReservationStatus;

  @Column({ name: 'IdempotencyKey', type: 'text' })
  idempotencyKey: string;

  @Column({ name: 'CreatedAt', type: 'text' })
  createdAt: string;
}
