/**
 * Forma ÚNICA de toda respuesta paginada con metadatos (spec 003 RF-6 y RNF-6):
 * cualquier buscador o listado con metadatos que se agregue usa exactamente esta.
 */
export interface Page<T> {
  items: T[];
  /** Cuántos elementos cumplen los filtros, sin paginar. */
  total: number;
  /** El `skip` aplicado (ya validado y, si era enorme, topado). */
  skip: number;
  /** El `limit` aplicado. */
  limit: number;
  /** ¿Quedan elementos después de esta página? */
  hasMore: boolean;
}

/** Arma la página y calcula `hasMore` en un solo lugar. */
export function toPage<T>(
  items: T[],
  total: number,
  skip: number,
  limit: number,
): Page<T> {
  return { items, total, skip, limit, hasMore: skip + items.length < total };
}
