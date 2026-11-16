import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tabla `Artist` de Chinook (camelCase → columnas PascalCase). */
@Entity({ name: 'Artist' })
export class Artist {
  @PrimaryGeneratedColumn({ name: 'ArtistId' })
  id: number;

  // En la base la columna admite NULL (datos heredados); la API exige nombre.
  @Column({ name: 'Name', type: 'varchar', length: 120, nullable: true })
  name: string | null;

  @Column({ name: 'ImageUrl', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;
}
