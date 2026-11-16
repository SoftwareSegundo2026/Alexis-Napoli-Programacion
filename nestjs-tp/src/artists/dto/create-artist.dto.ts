import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `POST /artists` (RF-6, RF-9). */
export class CreateArtistDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  Name: string;

  // Opcional y sin valor obligatorio: `null` o ausente = sin imagen.
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
