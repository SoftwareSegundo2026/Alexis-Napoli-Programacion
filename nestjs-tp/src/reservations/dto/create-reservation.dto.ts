import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/**
 * Cuerpo de `POST /reservations` (spec 004). NO declara `Status`: el estado lo
 * decide el servidor, y un campo desconocido en el cuerpo → 400 (caso 9).
 */
export class CreateReservationDto {
  @ApiProperty({ type: 'integer', example: 1 })
  @IsInt()
  @Min(1)
  ConcertId: number;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 10, example: 2 })
  @IsInt()
  @Min(1)
  @Max(10)
  Quantity: number;
}
