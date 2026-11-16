import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  bearer,
  expiredTokenFor,
  seedTestUsers,
  tamper,
  type TestUsers,
} from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

type WriteMethod = 'post' | 'patch' | 'delete';

const API = '/api/v1';
const RESOURCES = ['artists', 'albums', 'genres', 'tracks'] as const;

/** Las 12 rutas de escritura del catálogo: alta, modificación y baja de cada recurso. */
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

/** Campos exactos del contrato por recurso (spec 001 RNF-2: nada más). */
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

const INVALID_CREDENTIALS = { detail: 'Could not validate credentials' };

/**
 * Seguridad del catálogo. Migrado de la clave fija del TP-1 (spec 001 RF-11) a
 * la credencial con roles (spec 002 RF-3 a RF-6, RF-12): cada caso de la clave
 * tiene acá su equivalente con credencial, más los casos límite nuevos.
 */
describe('Seguridad (e2e) — spec 002 RF-3 a RF-6, RF-12; spec 001 RNF-2', () => {
  let app: INestApplication<App>;
  let users: TestUsers;

  beforeAll(async () => {
    app = await createTestApp();
    users = await seedTestUsers(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  /** Estado del recurso 1, para comprobar que nada cambió. */
  async function snapshot(path: string): Promise<unknown> {
    const response = await http()
      .get(`${path.replace(/\/1$/, '')}/1`)
      .expect(200);
    return response.body as unknown;
  }

  describe('las 12 rutas de escritura exigen credencial (RF-3)', () => {
    it.each(WRITE_ROUTES)(
      '%s %s sin credencial → 401 {"detail"} con WWW-Authenticate, y no modifica nada (casos 6, 24)',
      async (method, path) => {
        const before = await snapshot(path);

        const response = await http()[method](path).send({}).expect(401);

        expect(response.body).toEqual(INVALID_CREDENTIALS);
        expect(response.headers['www-authenticate']).toBe('Bearer');
        expect(await snapshot(path)).toEqual(before);
      },
    );

    it.each(WRITE_ROUTES)(
      '%s %s con credencial alterada → 401 (caso 5)',
      async (method, path) => {
        await http()
          [method](path)
          .set('Authorization', bearer(tamper(users.adminToken)))
          .expect(401, INVALID_CREDENTIALS);
      },
    );

    it.each(WRITE_ROUTES)(
      '%s %s con Authorization vacío → 401 (caso 12)',
      async (method, path) => {
        await http()[method](path).set('Authorization', '').expect(401);
      },
    );

    it.each(WRITE_ROUTES)(
      '%s %s como viewer → 403 Admin privileges required, y no modifica nada (caso 7)',
      async (method, path) => {
        const before = await snapshot(path);

        await http()
          [method](path)
          .set('Authorization', bearer(users.viewerToken))
          .send({})
          .expect(403, { detail: 'Admin privileges required' });

        expect(await snapshot(path)).toEqual(before);
      },
    );

    it('un alta sin credencial no crea nada', async () => {
      const before = await http().get(`${API}/genres`).expect(200);

      await http().post(`${API}/genres`).send({ Name: 'Intruso' }).expect(401);

      const after = await http().get(`${API}/genres`).expect(200);
      expect(after.body).toEqual(before.body);
    });

    it('credencial vencida → 401 (caso 4)', async () => {
      await http()
        .post(`${API}/genres`)
        .set('Authorization', bearer(await expiredTokenFor(users.admin)))
        .send({ Name: 'Vencido' })
        .expect(401, INVALID_CREDENTIALS);
    });

    it('credencial vigente de un usuario deshabilitado → 401 Inactive user (caso 3)', async () => {
      await http()
        .post(`${API}/genres`)
        .set('Authorization', bearer(users.disabledToken))
        .send({ Name: 'Deshabilitado' })
        .expect(401, { detail: 'Inactive user' });
    });

    it('la clave fija del TP-1 ya no da acceso (caso 25, RF-12)', async () => {
      await http()
        .post(`${API}/genres`)
        .set('X-API-Key', 'clave-de-prueba-e2e')
        .send({ Name: 'Con clave vieja' })
        .expect(401, INVALID_CREDENTIALS);
    });
  });

  describe('prioridad de errores: 401 → 403 → 400 → 404 → 409', () => {
    it('sin credencial y con cuerpo inválido → 401 (no 400)', async () => {
      await http()
        .post(`${API}/tracks`)
        .send({ Name: '', UnitPrice: -1 })
        .expect(401);
    });

    it('sin credencial y con JSON malformado → 401 (no 400) (caso 15)', async () => {
      await http()
        .post(`${API}/genres`)
        .set('Content-Type', 'application/json')
        .send('{"Name": ')
        .expect(401, INVALID_CREDENTIALS);
    });

    it('sin credencial y con id inexistente → 401 (no 404)', async () => {
      await http()
        .patch(`${API}/albums/99999`)
        .send({ Title: 'Nadie' })
        .expect(401);
    });

    it('sin credencial y con id no numérico → 401 (no 400)', async () => {
      await http().delete(`${API}/artists/abc`).expect(401);
    });

    it('sin credencial sobre un recurso en uso → 401 (no 409)', async () => {
      await http().delete(`${API}/genres/1`).expect(401);
    });

    it('viewer con cuerpo inválido → 403 (no 400) (caso 16)', async () => {
      await http()
        .post(`${API}/tracks`)
        .set('Authorization', bearer(users.viewerToken))
        .send({ Name: '', UnitPrice: -1 })
        .expect(403);
    });

    it('viewer con JSON malformado → 403 (no 400) (caso 16)', async () => {
      await http()
        .post(`${API}/genres`)
        .set('Authorization', bearer(users.viewerToken))
        .set('Content-Type', 'application/json')
        .send('{"Name": ')
        .expect(403);
    });

    it('admin con cuerpo inválido → llega a la validación → 400', async () => {
      await http()
        .post(`${API}/tracks`)
        .set('Authorization', bearer(users.adminToken))
        .send({ Name: '', UnitPrice: -1 })
        .expect(400);
    });

    it('admin con JSON malformado → 400 con {"detail"}', async () => {
      const response = await http()
        .post(`${API}/genres`)
        .set('Authorization', bearer(users.adminToken))
        .set('Content-Type', 'application/json')
        .send('{"Name": ')
        .expect(400);

      expect(Object.keys(response.body as object)).toEqual(['detail']);
    });
  });

  describe('el header Authorization (caso 12)', () => {
    it('el nombre del header y el esquema "bearer" no distinguen mayúsculas', async () => {
      await http()
        .patch(`${API}/genres/3`)
        .set('authorization', `bearer ${users.adminToken}`)
        .send({})
        .expect(200);
    });

    it('la credencial en sí sí distingue mayúsculas', async () => {
      await http()
        .patch(`${API}/genres/3`)
        .set('Authorization', bearer(users.adminToken.toUpperCase()))
        .send({})
        .expect(401);
    });

    it('otro esquema (Basic) → 401', async () => {
      await http()
        .patch(`${API}/genres/3`)
        .set('Authorization', `Basic ${users.adminToken}`)
        .send({})
        .expect(401);
    });
  });

  describe('las lecturas del catálogo son públicas (RF-5, HU-7)', () => {
    it.each(READ_ROUTES)('GET %s sin credencial → 200', async (path) => {
      await http().get(path).expect(200);
    });

    it.each(READ_ROUTES)(
      'GET %s con una credencial inválida → se ignora → 200 (caso 22)',
      async (path) => {
        await http()
          .get(path)
          .set('Authorization', 'Bearer credencial-basura')
          .expect(200);
      },
    );
  });

  describe('las respuestas solo traen campos del contrato (spec 001 RNF-2)', () => {
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
        http()
          .delete(`${API}/tracks/1`)
          .set('Authorization', bearer(users.adminToken)),
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
