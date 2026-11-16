import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Tabla `InvoiceLine` de Chinook, reducida a lo necesario. Solo lectura: se usa
 * para saber si una pista aparece en facturas antes de borrarla (RF-12).
 */
@Entity({ name: 'InvoiceLine' })
export class InvoiceLine {
  @PrimaryColumn({ name: 'InvoiceLineId', type: 'integer' })
  id: number;

  @Column({ name: 'TrackId', type: 'integer' })
  trackId: number;
}
