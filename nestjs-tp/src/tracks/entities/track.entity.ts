import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type ValueTransformer,
} from 'typeorm';
import { Album } from '../../albums/entities/album.entity.js';
import { Genre } from '../../genres/entities/genre.entity.js';
import { MediaType } from './media-type.entity.js';

/**
 * `UnitPrice` es NUMERIC(10,2): algunos drivers lo devuelven como texto. El
 * contrato exige un número JSON (`0.99`), así que se convierte siempre al leer.
 */
const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | number | null): number | null =>
    value === null ? null : Number(value),
};

/** Tabla `Track` de Chinook (camelCase → columnas PascalCase). */
@Entity({ name: 'Track' })
export class Track {
  @PrimaryGeneratedColumn({ name: 'TrackId' })
  id: number;

  @Column({ name: 'Name', type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'AlbumId', type: 'integer', nullable: true })
  albumId: number | null;

  @Column({ name: 'MediaTypeId', type: 'integer' })
  mediaTypeId: number;

  @Column({ name: 'GenreId', type: 'integer', nullable: true })
  genreId: number | null;

  @Column({ name: 'Composer', type: 'varchar', length: 220, nullable: true })
  composer: string | null;

  @Column({ name: 'Milliseconds', type: 'integer' })
  milliseconds: number;

  @Column({ name: 'Bytes', type: 'integer', nullable: true })
  bytes: number | null;

  @Column({
    name: 'UnitPrice',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPrice: number;

  // Relaciones de solo lectura para los campos derivados (RF-5); lo que se
  // guarda son los ids de arriba.
  @ManyToOne(() => Album, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'AlbumId' })
  album?: Album | null;

  @ManyToOne(() => Genre, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'GenreId' })
  genre?: Genre | null;

  @ManyToOne(() => MediaType, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'MediaTypeId' })
  mediaType?: MediaType | null;
}
