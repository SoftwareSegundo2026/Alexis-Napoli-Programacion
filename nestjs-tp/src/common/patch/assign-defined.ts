/**
 * Modificación parcial (PATCH): copia a `target` solo los campos de `changes`
 * que vinieron, es decir, los que no son `undefined`. `null` SÍ se copia: en
 * un opcional significa "quitar el valor" (spec 001 RF-7; spec 005 RF-9).
 *
 * Cada service arma `changes` con los nombres de su entidad, así la traducción
 * PascalCase (DTO) → camelCase (entidad) queda a la vista y tipada.
 */
export function assignDefined<T extends object>(
  target: T,
  changes: Partial<T>,
): T {
  for (const key in changes) {
    const value = changes[key];
    if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
}
