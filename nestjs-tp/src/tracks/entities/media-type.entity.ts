import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Tabla `MediaType` de Chinook. Solo lectura: no es un recurso de la API
 * (fuera de alcance); se usa para validar `MediaTypeId` y armar `MediaTypeName`.
 */
@Entity({ name: 'MediaType' })
export class MediaType {
  @PrimaryColumn({ name: 'MediaTypeId', type: 'integer' })
  id: number;

  @Column({ name: 'Name', type: 'varchar', length: 120, nullable: true })
  name: string | null;
}
