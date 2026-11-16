import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

/**
 * Spec 005 RF-7 (bug 2 del TP-1): un nombre de artista o género que ya pertenece
 * a otro, sin distinguir mayúsculas EN NINGUNA LETRA (también Á, Ô, Ñ, Ö…),
 * responde 409. Los acentos sí distinguen y `ß` frente a `SS` también.
 * Antes, el `LOWER()` de SQLite solo convertía A–Z y estos duplicados se creaban.
 *
 * Cada test usa nombres PROPIOS: si el bug dejara crear un duplicado, ese
 * registro no puede hacer pasar a otro test por el motivo equivocado.
 */
const GENRES = '/api/v1/genres';
const ARTISTS = '/api/v1/artists';

describe('Nombres repetidos con mayúsculas no ASCII (e2e, spec 005 RF-7)', () => {
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
  const post = (path: string, Name: string) =>
    asAdmin(request(app.getHttpServer()).post(path)).send({ Name });
  const patch = (path: string, id: number, Name: string) =>
    asAdmin(request(app.getHttpServer()).patch(`${path}/${id}`)).send({
      Name,
    });

  async function createId(path: string, name: string): Promise<number> {
    const response = await post(path, name).expect(201);
    const body = response.body as Record<string, number>;
    return Object.values(body)[0];
  }

  describe('alta (caso 9)', () => {
    it('género "CANCIÓN ÑANDÚ" existiendo "Canción Ñandú" → 409', async () => {
      await createId(GENRES, 'Canción Ñandú');

      await post(GENRES, 'CANCIÓN ÑANDÚ').expect(409);
    });

    it('género "piña colada" existiendo "PIÑA COLADA" → 409', async () => {
      await createId(GENRES, 'PIÑA COLADA');

      await post(GENRES, 'piña colada').expect(409);
    });

    it('artista "BJÖRK PRUEBA" existiendo "Björk Prueba" → 409', async () => {
      await createId(ARTISTS, 'Björk Prueba');

      await post(ARTISTS, 'BJÖRK PRUEBA').expect(409);
    });

    it('un artista REAL de Chinook en otras mayúsculas → 409', async () => {
      // Antônio Carlos Jobim (ArtistId 6) viene en la base original.
      await post(ARTISTS, 'ANTÔNIO CARLOS JOBIM').expect(409);
    });
  });

  describe('modificación (caso 10)', () => {
    it('cambiar un género a "ÑOÑO GÉNERO" existiendo "Ñoño Género" → 409', async () => {
      await createId(GENRES, 'Ñoño Género');
      const id = await createId(GENRES, 'Otro género T5');

      await patch(GENRES, id, 'ÑOÑO GÉNERO').expect(409);
    });

    it('cambiar un artista a "ÉMILE PRUEBA" existiendo "émile prueba" → 409', async () => {
      // La É tiene que CAMBIAR de mayúscula a minúscula: con "Émile" en los
      // dos nombres, SQLite no necesita convertirla y no sería el bug.
      await createId(ARTISTS, 'émile prueba');
      const id = await createId(ARTISTS, 'Otro artista T5');

      await patch(ARTISTS, id, 'ÉMILE PRUEBA').expect(409);
    });
  });

  describe('lo que NO es un duplicado', () => {
    it('los acentos distinguen: "Cancion Acentuada" existiendo "Canción Acentuada" → 201 (caso 11)', async () => {
      await createId(GENRES, 'Canción Acentuada');

      await post(GENRES, 'Cancion Acentuada').expect(201);
    });

    it('"STRASSE" existiendo "Straße" → 201: ß y SS son distintas (caso 19)', async () => {
      await createId(GENRES, 'Straße');

      await post(GENRES, 'STRASSE').expect(201);
    });
  });
});
