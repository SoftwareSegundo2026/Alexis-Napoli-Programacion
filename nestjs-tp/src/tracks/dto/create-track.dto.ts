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
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  Name: string;

  @IsOptional()
  @IsInt()
  AlbumId?: number | null;

  @IsInt()
  MediaTypeId: number;

  @IsOptional()
  @IsInt()
  GenreId?: number | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(220)
  Composer?: string | null;

  @IsInt()
  @Min(1)
  Milliseconds: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  Bytes?: number | null;

  // Número JSON (no texto), ≥ 0 y con hasta 2 decimales.
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  UnitPrice: number;
}
