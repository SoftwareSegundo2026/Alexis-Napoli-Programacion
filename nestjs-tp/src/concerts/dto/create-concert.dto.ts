import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `POST /concerts` (spec 004 RF-1). Que el artista exista y la fecha sea futura lo valida el service. */
export class CreateConcertDto {
  @ApiProperty({ type: 'integer', example: 1, description: 'Debe existir' })
  @IsInt()
  ArtistId: number;

  @ApiProperty({ maxLength: 160, example: 'Gira 2027' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  Title: string;

  @ApiProperty({
    example: '2027-03-15T21:00:00-03:00',
    description: 'ISO 8601 con zona explícita (Z o ±hh:mm); debe ser futura',
  })
  @IsString()
  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'StartsAt must include a time zone (Z or ±hh:mm)',
  })
  StartsAt: string;

  @ApiProperty({ type: 'integer', minimum: 1, maximum: 100000, example: 500 })
  @IsInt()
  @Min(1)
  @Max(100000)
  Capacity: number;

  @ApiProperty({
    minimum: 0,
    example: 25.5,
    description: 'Por entrada; hasta 2 decimales',
  })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  Price: number;
}
