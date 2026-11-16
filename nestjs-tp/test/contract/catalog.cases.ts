import { uniqueName, type ContractCase } from './contract-case.js';
import {
  ALBUM,
  ARTIST,
  EMPTY,
  ERROR_BODY,
  GENRE,
  list,
  object,
  TEXT,
  TRACK,
  type Shape,
} from './shapes.js';

const API = '/api/v1';
/** Id que no existe en la base de prueba. */
const MISSING_ID = 999999;
/** Id con formato inválido (no es entero) → 400. */
const BAD_ID = 'abc';

/** Lo que distingue a un recurso del catálogo dentro de su contrato. */
interface CatalogResource {
  /** Ruta sin el prefijo `/api/v1`, p. ej. `/genres`. */
  readonly path: string;
  readonly shape: Shape;
  /** Un id que existe en la Chinook original. */
  readonly existingId: number;
  /** Cuerpo de alta válido (nuevo en cada llamada, para no chocar con el nombre único). */
  validCreate(): object;
  /** Cuerpo de alta inválido → 400. */
  readonly invalidCreate: object;
  /** Cuerpo de modificación válido. */
  validUpdate(): object;
  /** Cuerpo de modificación inválido → 400. */
  readonly invalidUpdate: object;
  /** Si la documentación declara 409 en el alta y la modificación: un cuerpo que choca. */
  readonly conflictBody?: object;
  /** Un id de la Chinook original que no se puede borrar (en uso) → 409. */
  readonly inUseId: number;
}

/**
 * Casos de las 5 operaciones de un recurso del catálogo: el éxito y cada código
 * que la documentación declara (inventario de `/docs-json`, 16/11).
 */
function catalogCases(resource: CatalogResource): ContractCase[] {
  const base = `${API}${resource.path}`;
  const item = `${base}/{id}`;
  const one = object(resource.shape);
  const at = (id: number | string): string => `${base}/${id}`;

  const cases: ContractCase[] = [
    // GET /recurso — 200 400
    {
      operation: `GET ${base}`,
      status: 200,
      name: 'listado',
      expected: list(resource.shape),
      send: async (c) => c.http().get(base),
    },
    {
      operation: `GET ${base}`,
      status: 400,
      name: 'limit inválido',
      expected: ERROR_BODY,
      send: async (c) => c.http().get(base).query({ limit: 0 }),
    },
    // POST /recurso — 201 400 401 403 (409)
    {
      operation: `POST ${base}`,
      status: 201,
      name: 'alta válida',
      expected: one,
      send: async (c) =>
        c.asAdmin(c.http().post(base)).send(resource.validCreate()),
    },
    {
      operation: `POST ${base}`,
      status: 400,
      name: 'cuerpo inválido',
      expected: ERROR_BODY,
      send: async (c) =>
        c.asAdmin(c.http().post(base)).send(resource.invalidCreate),
    },
    {
      operation: `POST ${base}`,
      status: 401,
      name: 'sin credencial',
      expected: ERROR_BODY,
      send: async (c) => c.http().post(base).send(resource.validCreate()),
    },
    {
      operation: `POST ${base}`,
      status: 403,
      name: 'viewer',
      expected: ERROR_BODY,
      send: async (c) =>
        c.asViewer(c.http().post(base)).send(resource.validCreate()),
    },
    // GET /recurso/{id} — 200 400 404
    {
      operation: `GET ${item}`,
      status: 200,
      name: 'existente',
      expected: one,
      send: async (c) => c.http().get(at(resource.existingId)),
    },
    {
      operation: `GET ${item}`,
      status: 400,
      name: 'id no entero',
      expected: ERROR_BODY,
      send: async (c) => c.http().get(at(BAD_ID)),
    },
    {
      operation: `GET ${item}`,
      status: 404,
      name: 'inexistente',
      expected: ERROR_BODY,
      send: async (c) => c.http().get(at(MISSING_ID)),
    },
    // PATCH /recurso/{id} — 200 400 401 403 404 (409)
    {
      operation: `PATCH ${item}`,
      status: 200,
      name: 'modificación válida',
      expected: one,
      send: async (c) => {
        const id = await c.create(base, resource.validCreate());
        return c.asAdmin(c.http().patch(at(id))).send(resource.validUpdate());
      },
    },
    {
      operation: `PATCH ${item}`,
      status: 400,
      name: 'cuerpo inválido',
      expected: ERROR_BODY,
      send: async (c) =>
        c
          .asAdmin(c.http().patch(at(resource.existingId)))
          .send(resource.invalidUpdate),
    },
    {
      operation: `PATCH ${item}`,
      status: 401,
      name: 'sin credencial',
      expected: ERROR_BODY,
      send: async (c) =>
        c.http().patch(at(resource.existingId)).send(resource.validUpdate()),
    },
    {
      operation: `PATCH ${item}`,
      status: 403,
      name: 'viewer',
      expected: ERROR_BODY,
      send: async (c) =>
        c
          .asViewer(c.http().patch(at(resource.existingId)))
          .send(resource.validUpdate()),
    },
    {
      operation: `PATCH ${item}`,
      status: 404,
      name: 'inexistente',
      expected: ERROR_BODY,
      send: async (c) =>
        c.asAdmin(c.http().patch(at(MISSING_ID))).send(resource.validUpdate()),
    },
    // DELETE /recurso/{id} — 204 400 401 403 404 409
    {
      operation: `DELETE ${item}`,
      status: 204,
      name: 'baja de un recurso sin uso',
      expected: EMPTY,
      send: async (c) => {
        const id = await c.create(base, resource.validCreate());
        return c.asAdmin(c.http().delete(at(id)));
      },
    },
    {
      operation: `DELETE ${item}`,
      status: 400,
      name: 'id no entero',
      expected: ERROR_BODY,
      send: async (c) => c.asAdmin(c.http().delete(at(BAD_ID))),
    },
    {
      operation: `DELETE ${item}`,
      status: 401,
      name: 'sin credencial',
      expected: ERROR_BODY,
      send: async (c) => c.http().delete(at(resource.inUseId)),
    },
    {
      operation: `DELETE ${item}`,
      status: 403,
      name: 'viewer',
      expected: ERROR_BODY,
      send: async (c) => c.asViewer(c.http().delete(at(resource.inUseId))),
    },
    {
      operation: `DELETE ${item}`,
      status: 404,
      name: 'inexistente',
      expected: ERROR_BODY,
      send: async (c) => c.asAdmin(c.http().delete(at(MISSING_ID))),
    },
    {
      operation: `DELETE ${item}`,
      status: 409,
      name: 'recurso en uso',
      expected: ERROR_BODY,
      send: async (c) => c.asAdmin(c.http().delete(at(resource.inUseId))),
    },
  ];

  const conflictBody = resource.conflictBody;
  if (conflictBody !== undefined) {
    cases.push(
      {
        operation: `POST ${base}`,
        status: 409,
        name: 'nombre repetido',
        expected: ERROR_BODY,
        send: async (c) => c.asAdmin(c.http().post(base)).send(conflictBody),
      },
      {
        operation: `PATCH ${item}`,
        status: 409,
        name: 'nombre de otro',
        expected: ERROR_BODY,
        send: async (c) => {
          const id = await c.create(base, resource.validCreate());
          return c.asAdmin(c.http().patch(at(id))).send(conflictBody);
        },
      },
    );
  }
  return cases;
}

const named = (prefix: string) => (): object => ({ Name: uniqueName(prefix) });

/** Las 20 operaciones del catálogo, más la página de inicio (spec 001 y 002). */
export const CATALOG_CASES: readonly ContractCase[] = [
  {
    operation: 'GET /',
    status: 200,
    name: 'página de inicio',
    expected: TEXT,
    send: async (c) => c.http().get('/'),
  },
  ...catalogCases({
    path: '/genres',
    shape: GENRE,
    existingId: 1,
    validCreate: named('Género'),
    invalidCreate: {},
    validUpdate: named('Género cambiado'),
    invalidUpdate: { Name: '' },
    conflictBody: { Name: 'Rock' },
    inUseId: 1, // Rock tiene pistas
  }),
  ...catalogCases({
    path: '/artists',
    shape: ARTIST,
    existingId: 1,
    validCreate: named('Artista'),
    invalidCreate: {},
    validUpdate: named('Artista cambiado'),
    invalidUpdate: { Name: '' },
    conflictBody: { Name: 'AC/DC' },
    inUseId: 1, // AC/DC tiene álbumes
  }),
  ...catalogCases({
    path: '/albums',
    shape: ALBUM,
    existingId: 1,
    validCreate: () => ({ Title: uniqueName('Álbum'), ArtistId: 1 }),
    invalidCreate: { ArtistId: 1 },
    validUpdate: () => ({ Title: uniqueName('Álbum cambiado') }),
    invalidUpdate: { Title: '' },
    inUseId: 1, // tiene pistas
  }),
  ...catalogCases({
    path: '/tracks',
    shape: TRACK,
    existingId: 1,
    validCreate: () => ({
      Name: uniqueName('Pista'),
      MediaTypeId: 1,
      Milliseconds: 1000,
      UnitPrice: 0.99,
    }),
    invalidCreate: { Name: 'Sin el resto de los campos' },
    validUpdate: () => ({ Name: uniqueName('Pista cambiada') }),
    invalidUpdate: { Milliseconds: 0 },
    inUseId: 1, // está en facturas y playlists
  }),
];
