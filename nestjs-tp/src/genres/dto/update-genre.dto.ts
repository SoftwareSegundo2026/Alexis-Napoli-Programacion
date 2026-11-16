import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `PATCH /genres/{id}`: todo opcional, pero nunca `null` (RF-7, RF-9). */
export class UpdateGenreDto {
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  Name?: string;
}
