import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

interface ArtistBody {
  ArtistId: number;
  Name: string;
  ImageUrl: string | null;
}

const ARTISTS = '/api/v1/artists';

/**
 * Spec 004 RF-15 (pendiente de `001/validate.md`): dos modificaciones
 * simultáneas del mismo recurso → 200 y 200, y el recurso queda con los valores
 * de UNA de ellas completa: nunca una mezcla de campos ni un 500.
 */
describe('Modificaciones simultáneas del catálogo (e2e, spec 004 RF-15)', () => {
  let app: INestApplication<App>;
  let adminToken = '';

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await seedTestUsers(app)).adminToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const asAdmin = (test: request.Test) =>
    test.set('Authorization', bearer(adminToken));

  it('caso 27: en 10 rondas de dos PATCH simultáneos, siempre gana uno entero', async () => {
    const created = await asAdmin(request(app.getHttpServer()).post(ARTISTS))
      .send({ Name: 'Artista concurrente T7', ImageUrl: 'original.png' })
      .expect(201);
    const id = (created.body as ArtistBody).ArtistId;

    for (let round = 1; round <= 10; round += 1) {
      const a = { Name: `Versión A ${round}`, ImageUrl: `a-${round}.png` };
      const b = { Name: `Versión B ${round}`, ImageUrl: `b-${round}.png` };

      const responses = await Promise.all([
        asAdmin(request(app.getHttpServer()).patch(`${ARTISTS}/${id}`)).send(a),
        asAdmin(request(app.getHttpServer()).patch(`${ARTISTS}/${id}`)).send(b),
      ]);
      const final = (
        await request(app.getHttpServer()).get(`${ARTISTS}/${id}`).expect(200)
      ).body as ArtistBody;

      expect(responses.map((r) => r.status)).toEqual([200, 200]);
      const { Name, ImageUrl } = final;
      // Uno de los dos completo: nunca el nombre de uno con la imagen del otro.
      expect([a, b]).toContainEqual({ Name, ImageUrl });
    }
  });
});
