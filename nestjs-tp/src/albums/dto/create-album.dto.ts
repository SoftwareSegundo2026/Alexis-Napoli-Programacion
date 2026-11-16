import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TrimToNull } from '../../common/validation/trim-to-null.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `POST /albums` (RF-6, RF-9). Que el artista exista lo valida el service. */
export class CreateAlbumDto {
  @ApiProperty({ maxLength: 160, example: 'Highway to Hell' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  Title: string;

  @ApiProperty({ type: 'integer', example: 1, description: 'Debe existir' })
  @IsInt()
  ArtistId: number;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 })
  @IsOptional()
  @TrimToNull()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
