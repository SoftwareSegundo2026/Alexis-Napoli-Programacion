import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/**
 * Cuerpo de `PATCH /albums/{id}` (RF-7, RF-9).
 * No se usa `PartialType(CreateAlbumDto)` como en el andamio: haría opcionales
 * a Title y ArtistId con `@IsOptional`, que deja pasar `null`.
 */
export class UpdateAlbumDto {
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  Title?: string;

  @IfPresent()
  @IsInt()
  ArtistId?: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
