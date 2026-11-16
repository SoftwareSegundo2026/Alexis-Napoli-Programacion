import { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers, type TestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
const METHODS: Method[] = ['get', 'post', 'put', 'patch', 'delete'];

/**
 * Las ÚNICAS operaciones públicas que admite la spec 002 (RF-5): las lecturas
 * del catálogo y el login. Agregar algo acá exige un cambio de spec.
 */
const PUBLIC_OPERATIONS = new Set([
  'GET /api/v1/artists',
  'GET /api/v1/artists/{id}',
  'GET /api/v1/albums',
  'GET /api/v1/albums/{id}',
  'GET /api/v1/genres',
  'GET /api/v1/genres/{id}',
  'GET /api/v1/tracks',
  'GET /api/v1/tracks/{id}',
  // Spec 003 (TP-3): el buscador es una lectura del catálogo, pública.
  'GET /api/v1/tracks/search',
  // Spec 004 (TP-4): consultar conciertos es público (HU-1).
  'GET /api/v1/concerts',
  'GET /api/v1/concerts/{id}',
  'POST /api/v1/auth/token',
]);

/** Las únicas protegidas que NO exigen admin: el propio perfil (RF-7). */
const ANY_ROLE_OPERATIONS = new Set(['GET /api/v1/users/me']);

interface Operation {
  key: string;
  method: Method;
  path: string;
}

/**
 * Regresión de protección (spec 002 RF-5, RF-6; consigna TP-2): recorre TODAS
 * las operaciones reales de la API (el documento OpenAPI se genera desde los
 * controllers) y exige que nada quede abierto por olvido. Si alguien agrega un
 * endpoint y no lo protege, o se olvida de @Roles('admin'), este test falla.
 */
describe('Regresión: ninguna operación queda sin proteger (e2e)', () => {
  let app: INestApplication<App>;
  let users: TestUsers;
  let operations: Operation[];

  beforeAll(async () => {
    app = await createTestApp();
    users = await seedTestUsers(app);
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as OpenAPIObject;
    operations = Object.entries(document.paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
      .flatMap(([path, item]) =>
        METHODS.filter((method) => item[method] !== undefined).map(
          (method) => ({
            key: `${method.toUpperCase()} ${path}`,
            method,
            // Un id cualquiera: la protección se verifica antes de buscarlo.
            path: path.replace('{id}', '1'),
          }),
        ),
      );
  });

  afterAll(async () => {
    await app.close();
  });

  const send = (operation: Operation) =>
    request(app.getHttpServer())[operation.method](operation.path);

  // 25 hasta el TP-2; 26 desde la spec 003 (GET /tracks/search); 29 desde la
  // spec 004 (3 de conciertos).
  it('el inventario es la API completa (29 operaciones)', () => {
    expect(operations).toHaveLength(29);
  });

  it('toda operación NO pública responde 401 sin credencial', async () => {
    const open: string[] = [];
    for (const operation of operations) {
      if (PUBLIC_OPERATIONS.has(operation.key)) {
        continue;
      }
      const response = await send(operation).send({});
      if (response.status !== 401) {
        open.push(`${operation.key} → ${response.status}`);
      }
    }

    expect(open).toEqual([]);
  });

  it('toda operación que no sea pública ni del propio perfil exige admin: viewer → 403', async () => {
    const withoutRole: string[] = [];
    for (const operation of operations) {
      if (
        PUBLIC_OPERATIONS.has(operation.key) ||
        ANY_ROLE_OPERATIONS.has(operation.key)
      ) {
        continue;
      }
      const response = await send(operation)
        .set('Authorization', bearer(users.viewerToken))
        .send({});
      if (response.status !== 403) {
        withoutRole.push(`${operation.key} → ${response.status}`);
      }
    }

    expect(withoutRole).toEqual([]);
  });

  it('las operaciones públicas declaradas responden sin credencial (no 401)', async () => {
    for (const operation of operations) {
      if (!PUBLIC_OPERATIONS.has(operation.key)) {
        continue;
      }
      const response = await send(operation).send({});
      expect(response.status).not.toBe(401);
    }
  });

  it('la documentación coincide con la realidad: lo protegido declara Bearer y lo público no', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as OpenAPIObject;

    for (const operation of operations) {
      const [method, path] = operation.key.split(' ');
      const documented =
        document.paths[path][method.toLowerCase() as Method]?.security ?? [];
      expect([operation.key, documented.length > 0]).toEqual([
        operation.key,
        !PUBLIC_OPERATIONS.has(operation.key),
      ]);
    }
  });
});
