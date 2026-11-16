/**
 * Escapa los comodines de `LIKE` para que se busquen como caracteres comunes
 * (spec 003 RF-8): `%` ("cualquier cosa") y `_` ("un carácter") pasan a `\%` y
 * `\_`, y la propia `\` a `\\`. Se usa junto con `ESCAPE '\'` en la consulta.
 *
 * Esto NO es la protección contra inyección SQL (de eso se encarga pasar el
 * texto como parámetro): es para que buscar "100%" no traiga todo lo que empieza
 * con "100".
 */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}
