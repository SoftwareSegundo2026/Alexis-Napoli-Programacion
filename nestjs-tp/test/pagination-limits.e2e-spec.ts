import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

/**
 * Spec 005 RF-6 (bug 1 del TP-1): un `skip` de cualquier cantidad de dígitos
 * responde 200, y si supera la cantidad de elementos devuelve `[]`. Antes,
 * `?skip=99999999999999999999` respondía 500 (SQLite no admite un OFFSET
 * mayor que 2^63) y un skip de cientos de dígitos, 400.
 */
const LISTINGS = [
  '/api/v1/artists',
  '/api/v1/albums',
  '/api/v1/genres',
  '/api/v1/tracks',
  '/api/v1/users',
];
const HUGE_SKIP = '9'.repeat(20);

describe('Paginación con skip enorme (e2e, spec 005 RF-6)', () => {
  let app: INestApplication<App>;
  let adminToken = '';

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await seedTestUsers(app)).adminToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // El listado de usuarios exige admin; en los públicos la credencial se ignora.
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', bearer(adminToken));

  it.each(LISTINGS)(
    '%s?skip=<20 dígitos> → 200 con [] (caso 7)',
    async (path) => {
      const response = await get(path).query({ skip: HUGE_SKIP });

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    },
  );

  it('skip de 400 dígitos → 200 con [] (caso 17)', async () => {
    const response = await get('/api/v1/artists').query({
      skip: '9'.repeat(400),
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it('skip enorme con limit inválido → 400 por limit (caso 8)', async () => {
    const response = await get('/api/v1/artists').query({
      skip: HUGE_SKIP,
      limit: 0,
    });

    expect(response.status).toBe(400);
    expect((response.body as { detail: string }).detail).toMatch(/limit/);
  });
});
