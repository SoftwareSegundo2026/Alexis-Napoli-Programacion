/**
 * Funciones SQL propias, escritas en JavaScript y registradas en la conexión
 * de SQLite cada vez que se abre (`prepareDatabase` de TypeORM).
 *
 * Por qué existen (spec 005 RF-7, bug 2): el `LOWER()` de SQLite solo pasa a
 * minúsculas las letras A–Z, así que "CANCIÓN" y "canción" no se reconocían
 * como el mismo nombre.
 */

/**
 * Lo único que se usa de la conexión de better-sqlite3. Se declara acá porque
 * el paquete no trae tipos propios (y sumar `@types/...` sería una dependencia).
 */
export interface SqlFunctionRegistry {
  function(
    name: string,
    options: { deterministic: boolean },
    implementation: (value: unknown) => unknown,
  ): unknown;
}

/**
 * Minúsculas de Unicode, sin configuración regional: el mismo resultado en
 * cualquier servidor (`toLowerCase`, no `toLocaleLowerCase`). Las letras sin
 * equivalente uno a uno quedan distintas (`ß` ≠ `ss`), como fija la spec.
 * Lo que no es texto (p. ej. `NULL`) se devuelve igual.
 */
export function unicodeLower(value: unknown): unknown {
  return typeof value === 'string' ? value.toLowerCase() : value;
}

/** Registra `unicode_lower(texto)`. Es determinística: mismo texto → mismo resultado. */
export function registerSqlFunctions(database: SqlFunctionRegistry): void {
  database.function('unicode_lower', { deterministic: true }, unicodeLower);
}
