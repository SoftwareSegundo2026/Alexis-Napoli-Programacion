import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

describe('configureApp (e2e) — prefijo y contrato de errores', () => {
  let app: INestApplication<App>;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await seedTestUsers(app)).adminToken;
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

  // Desde la spec 002 el error de JSON se informa DESPUÉS de la credencial y el
  // rol (plan 002, decisión 2): estos casos usan una ruta real (`POST /genres`),
  // porque una ruta inexistente responde 404 antes de mirar el cuerpo.
  it('un cuerpo con JSON malformado responde 400 con {"detail"} (RF-10)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/genres')
      .set('Authorization', bearer(adminToken))
      .set('Content-Type', 'application/json')
      .send('{"Name": ')
      .expect(400);

    expect(Object.keys(response.body as object)).toEqual(['detail']);
  });

  it('JSON malformado SIN credencial → 401: la credencial se verifica primero (spec 002 caso 15)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/genres')
      .set('Content-Type', 'application/json')
      .send('{"Name": ')
      .expect(401);

    expect(Object.keys(response.body as object)).toEqual(['detail']);
  });

  it('una lectura no necesita credencial', async () => {
    await request(app.getHttpServer()).get('/').expect(200);
  });
});
