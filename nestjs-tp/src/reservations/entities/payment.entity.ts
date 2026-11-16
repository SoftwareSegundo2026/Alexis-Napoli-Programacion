import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { numericTransformer } from './reservation.entity.js';

/** Tabla `Payment`: un pago por reserva (spec 004). Nunca se expone por la API. */
@Entity({ name: 'Payment' })
export class Payment {
  @PrimaryGeneratedColumn({ name: 'PaymentId' })
  id: number;

  @Column({ name: 'ReservationId', type: 'integer' })
  reservationId: number;

  @Column({
    name: 'Amount',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  amount: number;

  @Column({ name: 'Status', type: 'text' })
  status: 'APPROVED' | 'REFUNDED';

  @Column({ name: 'CreatedAt', type: 'text' })
  createdAt: string;
}
