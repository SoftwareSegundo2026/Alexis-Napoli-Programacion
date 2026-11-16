import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';
import { TEST_WRITE_KEY } from './helpers/test-env.js';

type WriteMethod = 'post' | 'patch' | 'delete';

const API = '/api/v1';
const RESOURCES = ['artists', 'albums', 'genres', 'tracks'] as const;

/** Las 12 rutas de escritura: alta, modificación y baja de cada recurso. */
const WRITE_ROUTES: Array<[WriteMethod, string]> = RESOURCES.flatMap(
  (resource): Array<[WriteMethod, string]> => [
    ['post', `${API}/${resource}`],
    ['patch', `${API}/${resource}/1`],
    ['delete', `${API}/${resource}/1`],
  ],
);

/** Las 8 rutas de lectura: listado y consulta por id. */
const READ_ROUTES = RESOURCES.flatMap((resource) => [
  `${API}/${resource}`,
  `${API}/${resource}/1`,
]);

/** Campos exactos del contrato por recurso (RNF-2: nada más). */
const CONTRACT_FIELDS: Record<(typeof RESOURCES)[number], string[]> = {
  artists: ['ArtistId', 'ImageUrl', 'Name'],
  albums: ['AlbumId', 'ArtistId', 'ArtistName', 'ImageUrl', 'Title'],
  genres: ['GenreId', 'Name'],
  tracks: [
    'AlbumId',
    'AlbumTitle',
    'Bytes',
    'Composer',
    'GenreId',
    'GenreName',
    'MediaTypeId',
    'MediaTypeName',
    'Milliseconds',
    'Name',
    'TrackId',
    'UnitPrice',
  ],
};

describe('Seguridad (e2e) — RF-11, RNF-2', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** Estado de un recurso antes y después, para comprobar que nada cambió. */
  async function snapshot(path: string): Promise<unknown> {
    const response = await http().get(path).expect(200);
    return response.body as unknown;
  }

  describe('las 12 rutas de escritura exigen la clave (RF-11)', () => {
    it.each(WRITE_ROUTES)(
      '%s %s sin clave → 401 {"detail"} y no modifica nada',
      async (method, path) => {
        const before = await snapshot(`${path.replace(/\/1$/, '')}/1`);

        const response = await http()[method](path).send({}).expect(401);

        expect(response.body).toEqual({
          detail: 'Missing or invalid write key',
        });
        expect(await snapshot(`${path.replace(/\/1$/, '')}/1`)).toEqual(before);
      },
    );

    it.each(WRITE_ROUTES)(
      '%s %s con clave incorrecta → 401',
      async (method, path) => {
        await http()[method](path).set('X-API-Key', 'otra-clave').expect(401);
      },
    );

    it.each(WRITE_ROUTES)(
      '%s %s con clave vacía → 401',
      async (method, path) => {
        await http()[method](path).set('X-API-Key', '').expect(401);
      },
    );

    it('un alta sin clave no crea nada', async () => {
      const before = await http().get(`${API}/genres`).expect(200);

      await http().post(`${API}/genres`).send({ Name: 'Intruso' }).expect(401);

      const after = await http().get(`${API}/genres`).expect(200);
      expect(after.body).toEqual(before.body);
    });
  });

  describe('prioridad de errores: la clave se verifica primero', () => {
    it('sin clave y con cuerpo inválido → 401 (no 400)', async () => {
      await http()
        .post(`${API}/tracks`)
        .send({ Name: '', UnitPrice: -1 })
        .expect(401);
    });

    it('sin clave y con id inexistente → 401 (no 404)', async () => {
      await http()
        .patch(`${API}/albums/99999`)
        .send({ Title: 'Nadie' })
        .expect(401);
    });

    it('sin clave y con id no numérico → 401 (no 400)', async () => {
      await http().delete(`${API}/artists/abc`).expect(401);
    });

    it('sin clave sobre un recurso en uso → 401 (no 409)', async () => {
      await http().delete(`${API}/genres/1`).expect(401);
    });

    it('con clave, el mismo cuerpo inválido sí llega a la validación → 400', async () => {
      await http()
        .post(`${API}/tracks`)
        .set('X-API-Key', TEST_WRITE_KEY)
        .send({ Name: '', UnitPrice: -1 })
        .expect(400);
    });
  });

  describe('la clave', () => {
    it('el nombre del header no distingue mayúsculas (HTTP)', async () => {
      await http()
        .patch(`${API}/genres/3`)
        .set('x-api-key', TEST_WRITE_KEY)
        .send({})
        .expect(200);
    });

    it('el valor sí distingue mayúsculas', async () => {
      await http()
        .patch(`${API}/genres/3`)
        .set('X-API-Key', TEST_WRITE_KEY.toUpperCase())
        .send({})
        .expect(401);
    });
  });

  describe('las lecturas son libres (HU-1)', () => {
    it.each(READ_ROUTES)('GET %s sin clave → 200', async (path) => {
      await http().get(path).expect(200);
    });
  });

  describe('las respuestas solo traen campos del contrato (RNF-2)', () => {
    it.each(RESOURCES)('%s: listado y consulta por id', async (resource) => {
      const list = await http()
        .get(`${API}/${resource}`)
        .query({ limit: 5 })
        .expect(200);
      const one = await http().get(`${API}/${resource}/1`).expect(200);

      for (const item of [...(list.body as object[]), one.body as object]) {
        expect(Object.keys(item).sort()).toEqual(CONTRACT_FIELDS[resource]);
      }
    });

    it('los errores solo traen "detail"', async () => {
      const responses = await Promise.all([
        http().get(`${API}/tracks/99999`),
        http().get(`${API}/tracks/abc`),
        http().post(`${API}/tracks`).send({}),
        http().delete(`${API}/tracks/1`).set('X-API-Key', TEST_WRITE_KEY),
      ]);

      expect(responses.map((response) => response.status)).toEqual([
        404, 400, 401, 409,
      ]);
      for (const response of responses) {
        expect(Object.keys(response.body as object)).toEqual(['detail']);
      }
    });
  });
});
