import { ApiProperty } from '@nestjs/swagger';
import { Genre } from '../entities/genre.entity.js';

/** Género tal como lo expone la API (nombres del servicio original). */
export class GenreResponseDto {
  @ApiProperty({ example: 1 })
  GenreId: number;

  @ApiProperty({ type: String, nullable: true, example: 'Rock' })
  Name: string | null;

  /** Copia solo los campos del contrato: nada interno sale de acá (RNF-2). */
  static fromEntity(genre: Genre): GenreResponseDto {
    const dto = new GenreResponseDto();
    dto.GenreId = genre.id;
    dto.Name = genre.name;
    return dto;
  }
}
