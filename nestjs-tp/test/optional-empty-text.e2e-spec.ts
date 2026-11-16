import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

/**
 * Spec 005 RF-8 (bug 3 del TP-1), de punta a punta: un texto opcional vacío o
 * de solo espacios queda guardado como `null`, no como `""`. Cada caso relee
 * el recurso con un GET para comprobar lo que quedó EN LA BASE.
 */
describe('Textos opcionales vacíos → null (e2e, spec 005 RF-8)', () => {
  let app: INestApplication<App>;
  let adminToken = '';

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await seedTestUsers(app)).adminToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const asAdmin = (test: request.Test) =>
    test.set('Authorization', bearer(adminToken));

  it('alta de artista con ImageUrl "   " → 201 y queda null (caso 12)', async () => {
    const created = await asAdmin(http().post('/api/v1/artists'))
      .send({ Name: 'Artista con imagen vacía', ImageUrl: '   ' })
      .expect(201);
    const body = created.body as { ArtistId: number; ImageUrl: unknown };
    expect(body.ImageUrl).toBeNull();

    const stored = await http()
      .get(`/api/v1/artists/${body.ArtistId}`)
      .expect(200);
    expect((stored.body as { ImageUrl: unknown }).ImageUrl).toBeNull();
  });

  it('alta de álbum con ImageUrl "" → 201 y queda null (caso 12)', async () => {
    const created = await asAdmin(http().post('/api/v1/albums'))
      .send({ Title: 'Álbum con imagen vacía', ArtistId: 1, ImageUrl: '' })
      .expect(201);
    const body = created.body as { AlbumId: number; ImageUrl: unknown };
    expect(body.ImageUrl).toBeNull();

    const stored = await http()
      .get(`/api/v1/albums/${body.AlbumId}`)
      .expect(200);
    expect((stored.body as { ImageUrl: unknown }).ImageUrl).toBeNull();
  });

  it('PATCH de pista con Composer "  " → 200 y queda null (caso 13)', async () => {
    // La pista 1 tiene compositor en la Chinook original.
    const updated = await asAdmin(http().patch('/api/v1/tracks/1'))
      .send({ Composer: '  ' })
      .expect(200);
    expect((updated.body as { Composer: unknown }).Composer).toBeNull();

    const stored = await http().get('/api/v1/tracks/1').expect(200);
    expect((stored.body as { Composer: unknown }).Composer).toBeNull();
  });

  it('alta de usuario con full_name "   " → 201 y queda null (caso 14)', async () => {
    const created = await asAdmin(http().post('/api/v1/users'))
      .send({
        username: 'sin_nombre_completo',
        email: 'sin_nombre_completo@example.com',
        password: 'clave-de-prueba-123',
        full_name: '   ',
      })
      .expect(201);
    expect((created.body as { full_name: unknown }).full_name).toBeNull();
  });

  it('un obligatorio de solo espacios sigue → 400 (caso 15)', async () => {
    await asAdmin(http().post('/api/v1/artists'))
      .send({ Name: '   ' })
      .expect(400);
  });
});
