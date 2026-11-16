import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/**
 * Cuerpo de `PATCH /tracks/{id}` (RF-7, RF-9). Los obligatorios del alta usan
 * `@IfPresent()` (nunca `null`); los opcionales, `@IsOptional()` (`null` quita el valor).
 */
export class UpdateTrackDto {
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  Name?: string;

  @IsOptional()
  @IsInt()
  AlbumId?: number | null;

  @IfPresent()
  @IsInt()
  MediaTypeId?: number;

  @IsOptional()
  @IsInt()
  GenreId?: number | null;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(220)
  Composer?: string | null;

  @IfPresent()
  @IsInt()
  @Min(1)
  Milliseconds?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  Bytes?: number | null;

  @IfPresent()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  UnitPrice?: number;
}
