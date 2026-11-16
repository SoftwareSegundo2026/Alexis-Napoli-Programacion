import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `POST /albums` (RF-6, RF-9). Que el artista exista lo valida el service. */
export class CreateAlbumDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  Title: string;

  @IsInt()
  ArtistId: number;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  ImageUrl?: string | null;
}
