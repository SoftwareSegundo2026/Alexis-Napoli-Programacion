import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ maxLength: 200, description: 'No admite null' })
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  Name?: string;

  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description: 'Debe existir; null quita el álbum',
  })
  @IsOptional()
  @IsInt()
  AlbumId?: number | null;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Debe existir; no admite null',
  })
  @IfPresent()
  @IsInt()
  MediaTypeId?: number;

  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    description: 'Debe existir; null quita el género',
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

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    description: 'No admite null',
  })
  @IfPresent()
  @IsInt()
  @Min(1)
  Milliseconds?: number;

  @ApiPropertyOptional({ type: 'integer', nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  Bytes?: number | null;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Hasta 2 decimales; no admite null',
  })
  @IfPresent()
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  UnitPrice?: number;
}
