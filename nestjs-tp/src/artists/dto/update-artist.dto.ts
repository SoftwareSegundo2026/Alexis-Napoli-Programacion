import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `PATCH /artists/{id}` (RF-7, RF-9). */
export class UpdateArtistDto {
  // Obligatorio en el alta: si viene, no puede ser null ni vacío.
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  Name?: string;

  // Opcional: `null` quita la imagen.
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
