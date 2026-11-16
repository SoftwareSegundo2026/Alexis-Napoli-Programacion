import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app.js';

/** Chequeo de salud (spec 007 RF-5; casos 2 y 13). */
describe('GET /health (e2e, spec 007)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it('caso 13: sin credencial → 200 con la base arriba', async () => {
    const response = await http().get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('está fuera del prefijo /api/v1', async () => {
    await http().get('/api/v1/health').expect(404);
  });

  it('caso 2: con la conexión a la base cerrada → 503 con detail, sin el error interno', async () => {
    await app.get(DataSource).destroy();

    const response = await http().get('/health').expect(503);
    expect(response.body).toEqual({
      status: 'error',
      database: 'down',
      detail: 'Database unavailable',
    });
  });
});
