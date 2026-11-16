import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../../common/validation/trim.decorator.js';

/**
 * Cuerpo de `POST /tracks` (RF-6, RF-9; tabla de reglas de la spec).
 * Que los ids relacionados existan lo valida el service.
 */
export class CreateTrackDto {
  @ApiProperty({ maxLength: 200, example: 'Nueva canción' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  Name: string;

  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description: 'Si viene, debe existir',
  })
  @IsOptional()
  @IsInt()
  AlbumId?: number | null;

  @ApiProperty({ type: 'integer', example: 1, description: 'Debe existir' })
  @IsInt()
  MediaTypeId: number;

  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description: 'Si viene, debe existir',
  })
  @IsOptional()
  @IsInt()
  GenreId?: number | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 220 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(220)
  Composer?: string | null;

  @ApiProperty({ type: 'integer', minimum: 1, example: 180000 })
  @IsInt()
  @Min(1)
  Milliseconds: number;

  @ApiPropertyOptional({ type: 'integer', nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  Bytes?: number | null;

  // Número JSON (no texto), ≥ 0 y con hasta 2 decimales.
  @ApiProperty({ minimum: 0, example: 0.99, description: 'Hasta 2 decimales' })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  UnitPrice: number;
}
