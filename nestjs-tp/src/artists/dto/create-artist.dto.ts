import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TrimToNull } from '../../common/validation/trim-to-null.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `POST /artists` (RF-6, RF-9). */
export class CreateArtistDto {
  @ApiProperty({ maxLength: 120, example: 'Soda Stereo' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  Name: string;

  // Opcional y sin valor obligatorio: `null` o ausente = sin imagen.
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
