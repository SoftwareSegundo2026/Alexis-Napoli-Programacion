import { Album } from '../entities/album.entity.js';

/** Álbum tal como lo expone la API, con el nombre de su artista (RF-4). */
export class AlbumResponseDto {
  AlbumId: number;
  Title: string;
  ArtistId: number;
  ImageUrl: string | null;
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
