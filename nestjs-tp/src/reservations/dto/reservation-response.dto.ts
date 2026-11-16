import { ApiProperty } from '@nestjs/swagger';
import { RESERVATION_STATUSES } from '../reservation-status.js';
import type { Reservation } from '../entities/reservation.entity.js';

/** Reserva tal como la expone la API: sin usuario dueño ni datos del pago (spec 004). */
export class ReservationResponseDto {
  @ApiProperty({ example: 1 })
  ReservationId: number;

  @ApiProperty({ example: 1 })
  ConcertId: number;

  @ApiProperty({ example: 2 })
  Quantity: number;

  @ApiProperty({ example: 51, description: 'Quantity × Price del concierto' })
  Amount: number;

  @ApiProperty({ enum: RESERVATION_STATUSES, example: 'PAID' })
  Status: string;

  @ApiProperty({ example: '2026-11-16T15:00:00.000Z' })
  CreatedAt: string;

  static fromEntity(reservation: Reservation): ReservationResponseDto {
    const dto = new ReservationResponseDto();
    dto.ReservationId = reservation.id;
    dto.ConcertId = reservation.concertId;
    dto.Quantity = reservation.quantity;
    dto.Amount = reservation.amount;
    dto.Status = reservation.status;
    dto.CreatedAt = reservation.createdAt;
    return dto;
  }
}
