import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Artist } from '../../artists/entities/artist.entity.js';

/** Tabla `Album` de Chinook (camelCase → columnas PascalCase). */
@Entity({ name: 'Album' })
export class Album {
  @PrimaryGeneratedColumn({ name: 'AlbumId' })
  id: number;

  @Column({ name: 'Title', type: 'varchar', length: 160 })
  title: string;

  @Column({ name: 'ArtistId', type: 'integer' })
  artistId: number;

  @Column({ name: 'ImageUrl', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  /**
   * Relación de solo lectura para armar `ArtistName` (RF-4). El valor que se
   * guarda es `artistId`; la relación solo se carga al consultar.
   */
  @ManyToOne(() => Artist, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'ArtistId' })
  artist?: Artist;
}
