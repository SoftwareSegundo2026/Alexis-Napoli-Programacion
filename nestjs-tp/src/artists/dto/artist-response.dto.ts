import { ApiProperty } from '@nestjs/swagger';
import { Artist } from '../entities/artist.entity.js';

/** Artista tal como lo expone la API (nombres del servicio original). */
export class ArtistResponseDto {
  @ApiProperty({ example: 1 })
  ArtistId: number;

  @ApiProperty({ type: String, nullable: true, example: 'AC/DC' })
  Name: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '/static/images/artists/1.jpg',
  })
  ImageUrl: string | null;

  /** Copia solo los campos del contrato (RNF-2). */
  static fromEntity(artist: Artist): ArtistResponseDto {
    const dto = new ArtistResponseDto();
    dto.ArtistId = artist.id;
    dto.Name = artist.name;
    dto.ImageUrl = artist.imageUrl;
    return dto;
  }
}
