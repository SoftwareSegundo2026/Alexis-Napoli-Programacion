import { TEST_PASSWORDS } from '../helpers/auth.js';
import { uniqueUsername, type ContractCase } from './contract-case.js';
import { ERROR_BODY, list, object, TOKEN, USER } from './shapes.js';

const LOGIN = '/api/v1/auth/token';
const USERS = '/api/v1/users';
const ME = `${USERS}/me`;
const ITEM = `${USERS}/{id}`;
const MISSING_ID = 999999;

/** Alta de usuario válida y nueva en cada llamada (username y email únicos). */
function newUser(): object {
  const username = uniqueUsername();
  return {
    username,
    email: `${username}@example.com`,
    password: 'clave-de-prueba-123',
  };
}

/** Login y administración de usuarios (spec 002): éxito y cada código documentado. */
export const USERS_CASES: readonly ContractCase[] = [
  // POST /auth/token — 200 400 401 (público)
  {
    operation: `POST ${LOGIN}`,
    status: 200,
    name: 'credenciales correctas',
    expected: object(TOKEN),
    send: async (c) =>
      c
        .http()
        .post(LOGIN)
        .send({ username: 'test_admin', password: TEST_PASSWORDS.admin }),
  },
  {
    operation: `POST ${LOGIN}`,
    status: 400,
    name: 'faltan los campos',
    expected: ERROR_BODY,
    send: async (c) => c.http().post(LOGIN).send({}),
  },
  {
    operation: `POST ${LOGIN}`,
    status: 401,
    name: 'contraseña incorrecta',
    expected: ERROR_BODY,
    send: async (c) =>
      c
        .http()
        .post(LOGIN)
        .send({ username: 'test_admin', password: 'no-es-la-clave' }),
  },
  // GET /users/me — 200 401
  {
    operation: `GET ${ME}`,
    status: 200,
    name: 'perfil propio',
    expected: object(USER),
    send: async (c) => c.asViewer(c.http().get(ME)),
  },
  {
    operation: `GET ${ME}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(ME),
  },
  // GET /users — 200 400 401 403
  {
    operation: `GET ${USERS}`,
    status: 200,
    name: 'listado',
    expected: list(USER),
    send: async (c) => c.asAdmin(c.http().get(USERS)),
  },
  {
    operation: `GET ${USERS}`,
    status: 400,
    name: 'limit inválido',
    expected: ERROR_BODY,
    send: async (c) => c.asAdmin(c.http().get(USERS)).query({ limit: 0 }),
  },
  {
    operation: `GET ${USERS}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) => c.http().get(USERS),
  },
  {
    operation: `GET ${USERS}`,
    status: 403,
    name: 'viewer',
    expected: ERROR_BODY,
    send: async (c) => c.asViewer(c.http().get(USERS)),
  },
  // POST /users — 201 400 401 403 409
  {
    operation: `POST ${USERS}`,
    status: 201,
    name: 'alta válida',
    expected: object(USER),
    send: async (c) => c.asAdmin(c.http().post(USERS)).send(newUser()),
  },
  {
    operation: `POST ${USERS}`,
    status: 400,
    name: 'cuerpo inválido',
    expected: ERROR_BODY,
    send: async (c) =>
      c.asAdmin(c.http().post(USERS)).send({ username: 'sin_resto' }),
  },
  {
    operation: `POST ${USERS}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) => c.http().post(USERS).send(newUser()),
  },
  {
    operation: `POST ${USERS}`,
    status: 403,
    name: 'viewer',
    expected: ERROR_BODY,
    send: async (c) => c.asViewer(c.http().post(USERS)).send(newUser()),
  },
  {
    operation: `POST ${USERS}`,
    status: 409,
    name: 'username repetido',
    expected: ERROR_BODY,
    send: async (c) =>
      c.asAdmin(c.http().post(USERS)).send({
        username: 'test_viewer',
        email: 'otro-mail-contrato@example.com',
        password: 'clave-de-prueba-123',
      }),
  },
  // PATCH /users/{id} — 200 400 401 403 404
  {
    operation: `PATCH ${ITEM}`,
    status: 200,
    name: 'deshabilitar a otro usuario',
    expected: object(USER),
    send: async (c) => {
      const id = await c.create(USERS, newUser());
      return c
        .asAdmin(c.http().patch(`${USERS}/${id}`))
        .send({ disabled: true });
    },
  },
  {
    operation: `PATCH ${ITEM}`,
    status: 400,
    name: 'cuerpo inválido',
    expected: ERROR_BODY,
    send: async (c) =>
      c
        .asAdmin(c.http().patch(`${USERS}/${MISSING_ID}`))
        .send({ disabled: 'sí' }),
  },
  {
    operation: `PATCH ${ITEM}`,
    status: 401,
    name: 'sin credencial',
    expected: ERROR_BODY,
    send: async (c) =>
      c.http().patch(`${USERS}/${MISSING_ID}`).send({ disabled: true }),
  },
  {
    operation: `PATCH ${ITEM}`,
    status: 403,
    name: 'viewer',
    expected: ERROR_BODY,
    send: async (c) =>
      c
        .asViewer(c.http().patch(`${USERS}/${MISSING_ID}`))
        .send({ disabled: true }),
  },
  {
    operation: `PATCH ${ITEM}`,
    status: 404,
    name: 'inexistente',
    expected: ERROR_BODY,
    send: async (c) =>
      c
        .asAdmin(c.http().patch(`${USERS}/${MISSING_ID}`))
        .send({ disabled: true }),
  },
];
