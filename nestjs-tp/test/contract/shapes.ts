import type request from 'supertest';

/**
 * Formas esperadas de las respuestas, escritas A MANO desde las specs 001 y 002
 * (spec 005 RF-5). No se derivan de la documentación que genera la app: si el
 * código y la documentación cambiaran juntos, el contrato igual lo detecta.
 */

/** Tipos JSON que puede tener un campo. */
export type FieldType = 'number' | 'string' | 'boolean' | 'null';

/** Campo → tipos admitidos. El conjunto de campos es EXACTO: ni uno más ni uno menos. */
export type Shape = Readonly<Record<string, readonly FieldType[]>>;

/** Qué se espera en el cuerpo de una respuesta. */
export type ExpectedBody =
  | { readonly kind: 'object'; readonly shape: Shape }
  | { readonly kind: 'list'; readonly shape: Shape }
  /** Página con metadatos (spec 003 RF-6): `{ items: [<shape>], total, skip, limit, hasMore }`. */
  | { readonly kind: 'page'; readonly shape: Shape }
  | { readonly kind: 'empty' }
  | { readonly kind: 'text' };

// ── Formas de la API (specs 001 y 002) ────────────────────────────────────────

export const ARTIST: Shape = {
  ArtistId: ['number'],
  Name: ['string', 'null'],
  ImageUrl: ['string', 'null'],
};

export const GENRE: Shape = {
  GenreId: ['number'],
  Name: ['string', 'null'],
};

export const ALBUM: Shape = {
  AlbumId: ['number'],
  Title: ['string'],
  ArtistId: ['number'],
  ImageUrl: ['string', 'null'],
  ArtistName: ['string', 'null'],
};

export const TRACK: Shape = {
  TrackId: ['number'],
  Name: ['string'],
  AlbumId: ['number', 'null'],
  MediaTypeId: ['number'],
  GenreId: ['number', 'null'],
  Composer: ['string', 'null'],
  Milliseconds: ['number'],
  Bytes: ['number', 'null'],
  UnitPrice: ['number'],
  AlbumTitle: ['string', 'null'],
  GenreName: ['string', 'null'],
  MediaTypeName: ['string', 'null'],
};

export const USER: Shape = {
  user_id: ['number'],
  username: ['string'],
  email: ['string'],
  full_name: ['string', 'null'],
  disabled: ['boolean'],
  is_admin: ['boolean'],
};

export const TOKEN: Shape = {
  access_token: ['string'],
  token_type: ['string'],
};

/** Todo error de la API: exactamente `{"detail": "<texto>"}`. */
export const ERROR: Shape = { detail: ['string'] };

export const object = (shape: Shape): ExpectedBody => ({
  kind: 'object',
  shape,
});
export const list = (shape: Shape): ExpectedBody => ({ kind: 'list', shape });
export const page = (shape: Shape): ExpectedBody => ({ kind: 'page', shape });

/** Metadatos de toda página (spec 003 RF-6, RNF-6); `items` se verifica aparte. */
const PAGE_ENVELOPE: Readonly<Record<string, readonly string[]>> = {
  items: ['array'],
  total: ['number'],
  skip: ['number'],
  limit: ['number'],
  hasMore: ['boolean'],
};
export const EMPTY: ExpectedBody = { kind: 'empty' };
export const TEXT: ExpectedBody = { kind: 'text' };
export const ERROR_BODY: ExpectedBody = object(ERROR);

// ── Verificador ───────────────────────────────────────────────────────────────

function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return jsonType(value) === 'object';
}

/** Una lista CON elementos, cada uno con la forma dada (vacía no permite verificarla). */
function checkList(value: unknown, shape: Shape, where: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      `${where}: se esperaba una lista con elementos (${jsonType(value)})`,
    ];
  }
  return value.flatMap((item: unknown, index) =>
    checkShape(item, shape, `${where}[${index}]`),
  );
}

/** Problemas de un valor frente a una forma (vacío = coincide). */
function checkShape(
  value: unknown,
  shape: Readonly<Record<string, readonly string[]>>,
  where: string,
): string[] {
  if (!isRecord(value)) {
    return [`${where}: se esperaba un objeto y llegó ${jsonType(value)}`];
  }
  const problems: string[] = [];
  const expectedKeys = Object.keys(shape);
  for (const key of Object.keys(value)) {
    if (!expectedKeys.includes(key)) {
      problems.push(`${where}: campo que el contrato no declara: ${key}`);
    }
  }
  for (const key of expectedKeys) {
    if (!(key in value)) {
      problems.push(`${where}: falta el campo ${key}`);
      continue;
    }
    const actual = jsonType(value[key]);
    const allowed: readonly string[] = shape[key];
    if (!allowed.includes(actual)) {
      problems.push(
        `${where}.${key}: se esperaba ${allowed.join(' | ')} y llegó ${actual}`,
      );
    }
  }
  return problems;
}

/**
 * Compara una respuesta con lo esperado: código de estado, tipo de contenido y
 * forma del cuerpo. Devuelve la lista de problemas (vacía = cumple el contrato).
 */
export function checkResponse(
  response: request.Response,
  status: number,
  expected: ExpectedBody,
): string[] {
  const problems: string[] = [];
  const body: unknown = response.body;
  if (response.status !== status) {
    problems.push(`código: se esperaba ${status} y llegó ${response.status}`);
  }
  // `get` devuelve `undefined` en tiempo de ejecución si el header no viene (204).
  const contentType: string = response.get('Content-Type') ?? '';

  switch (expected.kind) {
    case 'empty':
      if (response.text !== '') {
        problems.push(`cuerpo: se esperaba vacío y llegó ${response.text}`);
      }
      break;
    case 'text':
      if (!contentType.startsWith('text/') || response.text === '') {
        problems.push(`cuerpo: se esperaba texto y llegó ${contentType}`);
      }
      break;
    case 'object':
    case 'list':
    case 'page':
      if (!contentType.startsWith('application/json')) {
        problems.push(`cuerpo: se esperaba JSON y llegó ${contentType}`);
        break;
      }
      if (expected.kind === 'object') {
        problems.push(...checkShape(body, expected.shape, 'cuerpo'));
      } else if (expected.kind === 'list') {
        problems.push(...checkList(body, expected.shape, 'cuerpo'));
      } else {
        problems.push(...checkShape(body, PAGE_ENVELOPE, 'cuerpo'));
        if (isRecord(body)) {
          problems.push(
            ...checkList(body.items, expected.shape, 'cuerpo.items'),
          );
        }
      }
      break;
  }
  return problems;
}
