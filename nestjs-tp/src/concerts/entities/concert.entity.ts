import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type ValueTransformer,
} from 'typeorm';
import { Artist } from '../../artists/entities/artist.entity.js';

/** `Price` es NUMERIC(10,2): se convierte siempre a número JSON al leer. */
const numericTransformer: ValueTransformer = {
  to: (value: number | null): number | null => value,
  from: (value: string | number | null): number | null =>
    value === null ? null : Number(value),
};

/**
 * Tabla `Concert` (creada por la migración de la spec 004). La disponibilidad
 * NO es una columna: se calcula a partir de las reservas (RF-2).
 */
@Entity({ name: 'Concert' })
export class Concert {
  @PrimaryGeneratedColumn({ name: 'ConcertId' })
  id: number;

  @Column({ name: 'ArtistId', type: 'integer' })
  artistId: number;

  @Column({ name: 'Title', type: 'varchar', length: 160 })
  title: string;

  /** ISO 8601 en UTC (`…Z`). */
  @Column({ name: 'StartsAt', type: 'text' })
  startsAt: string;

  @Column({ name: 'Capacity', type: 'integer' })
  capacity: number;

  @Column({
    name: 'Price',
    type: 'numeric',
    precision: 10,
    scale: 2,
    transformer: numericTransformer,
  })
  price: number;

  @ManyToOne(() => Artist, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'ArtistId' })
  artist?: Artist;
}
