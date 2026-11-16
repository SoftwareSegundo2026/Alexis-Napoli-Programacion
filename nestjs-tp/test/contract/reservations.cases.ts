import { newConcert } from './concerts.cases.js';
import { type ContractCase, type ContractContext } from './contract-case.js';
import { ERROR_BODY, list, object, RESERVATION } from './shapes.js';

const RESERVATIONS = '/api/v1/reservations';
const ITEM = `${RESERVATIONS}/{id}`;

let keyCounter = 0;
const nextKey = (): string => `clave-contrato-${++keyCounter}`;

/** POST /reservations como viewer, con una clave nueva (o la dada). */
const reserve = (c: ContractContext, body: object, key: string = nextKey()) =>
  c
    .asViewer(c.http().post(RESERVATIONS))
    .set('Idempotency-Key', key)
    .send(body);

/** Concierto propio del caso, con la capacidad pedida. */
const concert = (c: ContractContext, capacity = 10) =>
  c.create('/api/v1/concerts', newConcert(capacity));

/** Reserva propia del viewer; devuelve su id. */
async function ownReservation(c: ContractContext): Promise<number> {
  const concertId = await concert(c);
  const response = await reserve(c, { ConcertId: concertId, Quantity: 1 });
  return (response.body as { ReservationId: number }).ReservationId;
}

/** Reservas (spec 004): éxito y cada código documentado. */
export const RESERVATIONS_CASES: readonly ContractCase[] = [
  // POST /reservations — 201 400 401 402 404 409
  {
    operation: `POST ${RESERVATIONS}`,
    status: 201,
    name: 'reserva pagada',
    expected: object(RESERVATION),
    send: async (c) => reserve(c, { ConcertId: await concert(c), Quantity: 2 }),
  },
  {
    operation: `POST ${RESERVATIONS}`,
    status: 400,
    name: 'cantidad inválida',
    expected: ERROR_BODY,
    send: async (c) => reserve(c, { ConcertId: await concert(c), Quantity: 0 }),
  },
  {
    operation: `POST ${RESERVATIONS}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) =>
      c
        .http()
        .post(RESERVATIONS)
        .set('Idempotency-Key', nextKey())
        .send({ ConcertId: 1, Quantity: 1 }),
  },
  {
    operation: `POST ${RESERVATIONS}`,
    status: 402,
    name: 'pago rechazado',
    expected: ERROR_BODY,
    send: async (c) => {
      const concertId = await concert(c);
      c.setPaymentMode('reject');
      try {
        return await reserve(c, { ConcertId: concertId, Quantity: 1 });
      } finally {
        c.setPaymentMode('approve');
      }
    },
  },
  {
    operation: `POST ${RESERVATIONS}`,
    status: 404,
    name: 'concierto inexistente',
    expected: ERROR_BODY,
    send: async (c) => reserve(c, { ConcertId: 999999, Quantity: 1 }),
  },
  {
    operation: `POST ${RESERVATIONS}`,
    status: 409,
    name: 'sin entradas suficientes',
    expected: ERROR_BODY,
    send: async (c) =>
      reserve(c, { ConcertId: await concert(c, 1), Quantity: 2 }),
  },
  // GET /reservations — 200 400 401
  {
    operation: `GET ${RESERVATIONS}`,
    status: 200,
    name: 'las propias',
    expected: list(RESERVATION),
    send: async (c) => {
      await ownReservation(c); // la lista tiene que tener elementos
      return c.asViewer(c.http().get(RESERVATIONS));
    },
  },
  {
    operation: `GET ${RESERVATIONS}`,
    status: 400,
    name: 'limit inválido',
    expected: ERROR_BODY,
    send: async (c) =>
      c.asViewer(c.http().get(RESERVATIONS)).query({ limit: 0 }),
  },
  {
    operation: `GET ${RESERVATIONS}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(RESERVATIONS),
  },
  // GET /reservations/{id} — 200 400 401 404
  {
    operation: `GET ${ITEM}`,
    status: 200,
    name: 'la propia',
    expected: object(RESERVATION),
    send: async (c) =>
      c.asViewer(c.http().get(`${RESERVATIONS}/${await ownReservation(c)}`)),
  },
  {
    operation: `GET ${ITEM}`,
    status: 400,
    name: 'id no entero',
    expected: ERROR_BODY,
    send: async (c) => c.asViewer(c.http().get(`${RESERVATIONS}/abc`)),
  },
  {
    operation: `GET ${ITEM}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(`${RESERVATIONS}/1`),
  },
  {
    operation: `GET ${ITEM}`,
    status: 404,
    name: 'inexistente',
    expected: ERROR_BODY,
    send: async (c) => c.asViewer(c.http().get(`${RESERVATIONS}/999999`)),
  },
];
