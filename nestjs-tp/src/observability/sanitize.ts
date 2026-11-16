/**
 * Saneo de todo lo que se escribe en los logs (spec 007 RF-14): un log se
 * copia, se reenvía y lo lee gente que no debería ver contraseñas ni
 * credenciales. Por eso, además de no registrar nunca cuerpos ni headers,
 * cualquier texto que llega al logger pasa por acá.
 */

/** Lo que reemplaza a un dato sensible. */
export const REDACTED = '[REDACTED]';

/** Palabras que hacen sensible a un campo si aparecen en su nombre. */
const SENSITIVE_WORDS = ['password', 'token', 'secret', 'authorization', 'dni'];

/** `Bearer <credencial>` (header Authorization copiado en un mensaje). */
const BEARER = /\bBearer\s+[\w.~+/=-]+/gi;

/** Un JWT suelto: tres partes base64url separadas por puntos, la primera `eyJ…`. */
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;

/**
 * `campo=valor`, `campo: valor`, `"campo":"valor"` o `'campo': 'valor'`, donde
 * el nombre del campo CONTIENE una palabra sensible (`newPassword`,
 * `access_token`, `JWT_SECRET`…). Tapar de más es preferible a filtrar de menos.
 */
const SENSITIVE_FIELD = new RegExp(
  String.raw`(["']?)([\w-]*(?:${SENSITIVE_WORDS.join('|')})[\w-]*)\1(\s*[:=]\s*)("(?:[^"\\]|\\.)*"|'[^']*'|[^\s,;&}]+)`,
  'gi',
);

/** Tapa credenciales y valores de campos sensibles dentro de un texto. */
export function sanitize(text: string): string {
  return text
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(
      SENSITIVE_FIELD,
      (_match, quote: string, key: string, separator: string, value: string) =>
        `${quote}${key}${quote}${separator}${quoted(value, REDACTED)}`,
    );
}

/** Conserva las comillas del valor original: así un JSON sigue siendo JSON. */
function quoted(original: string, replacement: string): string {
  const first = original.charAt(0);
  return first === '"' || first === "'"
    ? `${first}${replacement}${first}`
    : replacement;
}

/** `true` si el nombre del campo contiene una palabra sensible. */
function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_WORDS.some((word) => lower.includes(word));
}

/**
 * Sanea un valor cualquiera para el log: tapa por NOMBRE de campo (en
 * cualquier nivel de anidamiento) y sanea todos los textos.
 */
export function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitize(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSensitiveKey(key) ? REDACTED : sanitizeValue(item),
      ]),
    );
  }
  return value;
}
