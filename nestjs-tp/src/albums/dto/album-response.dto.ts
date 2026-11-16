import { ApiProperty } from '@nestjs/swagger';
import { Album } from '../entities/album.entity.js';

/** Álbum tal como lo expone la API, con el nombre de su artista (RF-4). */
export class AlbumResponseDto {
  @ApiProperty({ example: 2 })
  AlbumId: number;

  @ApiProperty({ example: 'Balls to the Wall' })
  Title: string;

  @ApiProperty({ example: 2 })
  ArtistId: number;

  @ApiProperty({ type: String, nullable: true })
  ImageUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Accept' })
  ArtistName: string | null;

  /** Copia solo los campos del contrato (RNF-2). */
  static fromEntity(album: Album): AlbumResponseDto {
    const dto = new AlbumResponseDto();
    dto.AlbumId = album.id;
    dto.Title = album.title;
    dto.ArtistId = album.artistId;
    dto.ImageUrl = album.imageUrl;
    dto.ArtistName = album.artist?.name ?? null;
    return dto;
  }
}
