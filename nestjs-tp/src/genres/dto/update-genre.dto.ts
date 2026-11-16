import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `PATCH /genres/{id}`: todo opcional, pero nunca `null` (RF-7, RF-9). */
export class UpdateGenreDto {
  @ApiPropertyOptional({ maxLength: 120, description: 'No admite null' })
  @IfPresent()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  Name?: string;
}
