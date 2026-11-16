import { uniqueName, type ContractCase } from './contract-case.js';
import { CONCERT, ERROR_BODY, list, object } from './shapes.js';

const CONCERTS = '/api/v1/concerts';
const ITEM = `${CONCERTS}/{id}`;

/** Alta de concierto válida y nueva en cada llamada. */
export function newConcert(capacity = 100, price = 10): object {
  return {
    ArtistId: 1,
    Title: uniqueName('Concierto'),
    StartsAt: '2099-06-01T21:00:00Z',
    Capacity: capacity,
    Price: price,
  };
}

/** Conciertos (spec 004): éxito y cada código documentado. */
export const CONCERTS_CASES: readonly ContractCase[] = [
  // GET /concerts — 200 400 (público)
  {
    operation: `GET ${CONCERTS}`,
    status: 200,
    name: 'listado',
    expected: list(CONCERT),
    send: async (c) => {
      await c.create(CONCERTS, newConcert()); // la lista tiene que tener elementos
      return c.http().get(CONCERTS);
    },
  },
  {
    operation: `GET ${CONCERTS}`,
    status: 400,
    name: 'limit inválido',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(CONCERTS).query({ limit: 0 }),
  },
  // GET /concerts/{id} — 200 400 404 (público)
  {
    operation: `GET ${ITEM}`,
    status: 200,
    name: 'existente',
    expected: object(CONCERT),
    send: async (c) => {
      const id = await c.create(CONCERTS, newConcert());
      return c.http().get(`${CONCERTS}/${id}`);
    },
  },
  {
    operation: `GET ${ITEM}`,
    status: 400,
    name: 'id no entero',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(`${CONCERTS}/abc`),
  },
  {
    operation: `GET ${ITEM}`,
    status: 404,
    name: 'inexistente',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(`${CONCERTS}/999999`),
  },
  // POST /concerts — 201 400 401 403 (admin)
  {
    operation: `POST ${CONCERTS}`,
    status: 201,
    name: 'alta válida',
    expected: object(CONCERT),
    send: async (c) => c.asAdmin(c.http().post(CONCERTS)).send(newConcert()),
  },
  {
    operation: `POST ${CONCERTS}`,
    status: 400,
    name: 'cuerpo inválido',
    expected: ERROR_BODY,
    send: async (c) => c.asAdmin(c.http().post(CONCERTS)).send({}),
  },
  {
    operation: `POST ${CONCERTS}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) => c.http().post(CONCERTS).send(newConcert()),
  },
  {
    operation: `POST ${CONCERTS}`,
    status: 403,
    name: 'viewer',
    expected: ERROR_BODY,
    send: async (c) => c.asViewer(c.http().post(CONCERTS)).send(newConcert()),
  },
];
