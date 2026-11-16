import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Tabla `Genre` de Chinook. Las propiedades van en camelCase y se mapean a las
 * columnas PascalCase de la base; el contrato HTTP lo arma el DTO de salida.
 */
@Entity({ name: 'Genre' })
export class Genre {
  @PrimaryGeneratedColumn({ name: 'GenreId' })
  id: number;

  // En la base la columna admite NULL (datos heredados); la API exige nombre.
  @Column({ name: 'Name', type: 'varchar', length: 120, nullable: true })
  name: string | null;
}
