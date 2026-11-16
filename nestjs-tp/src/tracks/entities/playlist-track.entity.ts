import { Entity, PrimaryColumn } from 'typeorm';

/**
 * Tabla `PlaylistTrack` de Chinook (clave compuesta). Solo lectura: se usa para
 * saber si una pista está en alguna playlist antes de borrarla (RF-12).
 */
@Entity({ name: 'PlaylistTrack' })
export class PlaylistTrack {
  @PrimaryColumn({ name: 'PlaylistId', type: 'integer' })
  playlistId: number;

  @PrimaryColumn({ name: 'TrackId', type: 'integer' })
  trackId: number;
}
