import { Track } from '../entities/track.entity.js';

/** Pista tal como la expone la API, con los nombres de sus relaciones (RF-5). */
export class TrackResponseDto {
  TrackId: number;
  Name: string;
  AlbumId: number | null;
  MediaTypeId: number;
  GenreId: number | null;
  Composer: string | null;
  Milliseconds: number;
  Bytes: number | null;
  UnitPrice: number;
  AlbumTitle: string | null;
  GenreName: string | null;
  MediaTypeName: string | null;

  /** Copia solo los campos del contrato (RNF-2); sin relación → `null`. */
  static fromEntity(track: Track): TrackResponseDto {
    const dto = new TrackResponseDto();
    dto.TrackId = track.id;
    dto.Name = track.name;
    dto.AlbumId = track.albumId;
    dto.MediaTypeId = track.mediaTypeId;
    dto.GenreId = track.genreId;
    dto.Composer = track.composer;
    dto.Milliseconds = track.milliseconds;
    dto.Bytes = track.bytes;
    dto.UnitPrice = track.unitPrice;
    dto.AlbumTitle = track.album?.title ?? null;
    dto.GenreName = track.genre?.name ?? null;
    dto.MediaTypeName = track.mediaType?.name ?? null;
    return dto;
  }
}
