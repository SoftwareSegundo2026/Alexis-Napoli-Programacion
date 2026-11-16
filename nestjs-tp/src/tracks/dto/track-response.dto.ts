import { ApiProperty } from '@nestjs/swagger';
import { Track } from '../entities/track.entity.js';

/** Pista tal como la expone la API, con los nombres de sus relaciones (RF-5). */
export class TrackResponseDto {
  @ApiProperty({ example: 1 })
  TrackId: number;

  @ApiProperty({ example: 'For Those About To Rock (We Salute You)' })
  Name: string;

  @ApiProperty({ type: 'integer', nullable: true, example: 1 })
  AlbumId: number | null;

  @ApiProperty({ example: 1 })
  MediaTypeId: number;

  @ApiProperty({ type: 'integer', nullable: true, example: 1 })
  GenreId: number | null;

  @ApiProperty({ type: String, nullable: true })
  Composer: string | null;

  @ApiProperty({ example: 343719 })
  Milliseconds: number;

  @ApiProperty({ type: 'integer', nullable: true, example: 11170334 })
  Bytes: number | null;

  @ApiProperty({ example: 0.99 })
  UnitPrice: number;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null si no tiene álbum',
  })
  AlbumTitle: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null si no tiene género',
  })
  GenreName: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'MPEG audio file' })
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
