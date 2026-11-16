import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';
import { TEST_WRITE_KEY } from './helpers/test-env.js';

describe('configureApp (e2e) — prefijo y contrato de errores', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / queda fuera del prefijo /api/v1', async () => {
    await request(app.getHttpServer()).get('/').expect(200, 'Hello World!');
  });

  it('una ruta inexistente responde 404 con {"detail"} y nada más', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/no-existe')
      .expect(404);

    expect(Object.keys(response.body as object)).toEqual(['detail']);
    expect(typeof (response.body as { detail: unknown }).detail).toBe('string');
  });

  it('un cuerpo con JSON malformado responde 400 con {"detail"} (RF-10)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/no-existe')
      .set('X-API-Key', TEST_WRITE_KEY)
      .set('Content-Type', 'application/json')
      .send('{"Name": ')
      .expect(400);

    expect(Object.keys(response.body as object)).toEqual(['detail']);
  });
});
