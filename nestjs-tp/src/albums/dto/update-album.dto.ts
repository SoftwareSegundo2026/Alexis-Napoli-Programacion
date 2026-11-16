import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';
import { TrimToNull } from '../../common/validation/trim-to-null.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/**
 * Cuerpo de `PATCH /albums/{id}` (RF-7, RF-9).
 * No se usa `PartialType(CreateAlbumDto)` como en el andamio: haría opcionales
 * a Title y ArtistId con `@IsOptional`, que deja pasar `null`.
 */
export class UpdateAlbumDto {
  @ApiPropertyOptional({ maxLength: 160, description: 'No admite null' })
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  Title?: string;

  @ApiPropertyOptional({
    type: 'integer',
    description: 'Debe existir; no admite null',
  })
  @IfPresent()
  @IsInt()
  ArtistId?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 500,
    description: 'null quita la imagen',
  })
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
