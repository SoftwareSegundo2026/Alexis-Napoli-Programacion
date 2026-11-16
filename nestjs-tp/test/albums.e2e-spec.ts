import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';
import { bearer, seedTestUsers } from './helpers/auth.js';

interface AlbumBody {
  AlbumId: number;
  Title: string;
  ArtistId: number;
  ImageUrl: string | null;
  ArtistName: string | null;
}

interface ErrorBody {
  detail: string;
}

const BASE = '/api/v1/albums';

describe('Álbumes (e2e)', () => {
  let app: INestApplication<App>;

  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = (await seedTestUsers(app)).adminToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  // Escrituras como admin (spec 002: reemplaza a la clave fija del TP-1).
  const asAdmin = (test: request.Test) =>
    test.set('Authorization', bearer(adminToken));

  async function albumCount(): Promise<number> {
    const response = await http()
      .get(BASE)
      .query({ skip: 300, limit: 100 })
      .expect(200);
    return 300 + (response.body as AlbumBody[]).length;
  }

  async function createAlbum(body: object): Promise<AlbumBody> {
    const response = await asAdmin(http().post(BASE)).send(body).expect(201);
    return response.body as AlbumBody;
  }

  describe('lectura (RF-1, RF-2, RF-3, RF-4)', () => {
    it('lista ordenada por id, con ArtistName y solo los campos del contrato', async () => {
      const response = await http().get(BASE).query({ limit: 3 }).expect(200);
      const albums = response.body as AlbumBody[];

      expect(albums.map((a) => a.AlbumId)).toEqual([1, 2, 3]);
      expect(albums[1]).toEqual({
        AlbumId: 2,
        Title: 'Balls to the Wall',
        ArtistId: 2,
        ImageUrl: '/static/images/albums/2.jpg',
        ArtistName: 'Accept',
      });
    });

    it('sin parámetros devuelve 100; skip mayor que el total → []', async () => {
      const page = await http().get(BASE).expect(200);
      expect(page.body as AlbumBody[]).toHaveLength(100);
      await http().get(BASE).query({ skip: 5000 }).expect(200, []);
    });

    it('consulta por id con ArtistName; inexistente → 404; no entero → 400', async () => {
      const response = await http().get(`${BASE}/1`).expect(200);
      expect((response.body as AlbumBody).ArtistName).toBe('AC/DC');

      await http()
        .get(`${BASE}/9999`)
        .expect(404, { detail: 'Album not found' });
      await http().get(`${BASE}/abc`).expect(400);
    });
  });

  describe('alta (RF-6, RF-9)', () => {
    it('crea con 201 e incluye el ArtistName derivado', async () => {
      const created = await createAlbum({ Title: '  Highway  ', ArtistId: 1 });

      expect(created).toEqual({
        AlbumId: expect.any(Number),
        Title: 'Highway',
        ArtistId: 1,
        ImageUrl: null,
        ArtistName: 'AC/DC',
      });
      await http().get(`${BASE}/${created.AlbumId}`).expect(200, created);
    });

    it('un título repetido está permitido (la base original los tiene)', async () => {
      await createAlbum({ Title: 'Balls to the Wall', ArtistId: 2 });
    });

    it('ArtistId inexistente → 400 que lo nombra, y no guarda', async () => {
      const before = await albumCount();

      const response = await asAdmin(http().post(BASE))
        .send({ Title: 'Huérfano', ArtistId: 9999 })
        .expect(400);

      expect((response.body as ErrorBody).detail).toMatch(/ArtistId/);
      expect(await albumCount()).toBe(before);
    });

    it.each([
      [{ ArtistId: 1 }, /Title/],
      [{ Title: '', ArtistId: 1 }, /Title/],
      [{ Title: 'Sin artista' }, /ArtistId/],
      [{ Title: 'Texto', ArtistId: 'uno' }, /ArtistId/],
      [{ Title: 'Extra', ArtistId: 1, ArtistName: 'X' }, /ArtistName/],
    ])('cuerpo inválido %j → 400 que nombra el campo', async (body, field) => {
      const response = await asAdmin(http().post(BASE)).send(body).expect(400);

      expect((response.body as ErrorBody).detail).toMatch(field);
    });
  });

  describe('modificación (RF-7, RF-9)', () => {
    it('cambiar de artista actualiza ArtistId y ArtistName; el resto se conserva', async () => {
      const created = await createAlbum({
        Title: 'Para Mover',
        ArtistId: 1,
        ImageUrl: '/img/mover.jpg',
      });

      await asAdmin(http().patch(`${BASE}/${created.AlbumId}`))
        .send({ ArtistId: 2 })
        .expect(200, {
          AlbumId: created.AlbumId,
          Title: 'Para Mover',
          ArtistId: 2,
          ImageUrl: '/img/mover.jpg',
          ArtistName: 'Accept',
        });
    });

    it('ArtistId inexistente al modificar → 400 y no cambia nada', async () => {
      await asAdmin(http().patch(`${BASE}/2`))
        .send({ ArtistId: 9999 })
        .expect(400);
      const response = await http().get(`${BASE}/2`).expect(200);
      expect((response.body as AlbumBody).ArtistId).toBe(2);
    });

    it('{} → 200 sin cambios; Title en null → 400; id inexistente → 404', async () => {
      const before = await http().get(`${BASE}/3`).expect(200);

      await asAdmin(http().patch(`${BASE}/3`))
        .send({})
        .expect(200, before.body as AlbumBody);
      await asAdmin(http().patch(`${BASE}/3`))
        .send({ Title: null })
        .expect(400);
      await asAdmin(http().patch(`${BASE}/9999`))
        .send({ Title: 'Nadie' })
        .expect(404, { detail: 'Album not found' });
    });
  });

  describe('baja (RF-8, RF-12)', () => {
    it('un álbum con pistas → 409 que lo explica, y no se borra', async () => {
      const response = await asAdmin(http().delete(`${BASE}/1`)).expect(409);

      expect((response.body as ErrorBody).detail).toMatch(/track/);
      await http().get(`${BASE}/1`).expect(200);
    });

    it('un álbum sin pistas → 204 sin cuerpo; después 404', async () => {
      const created = await createAlbum({ Title: 'Para Borrar', ArtistId: 1 });

      const response = await asAdmin(
        http().delete(`${BASE}/${created.AlbumId}`),
      ).expect(204);

      expect(response.text).toBe('');
      await http().get(`${BASE}/${created.AlbumId}`).expect(404);
    });

    it('al borrar el álbum, el artista recupera la posibilidad de borrarse si no le quedan otros', async () => {
      const artist = await asAdmin(http().post('/api/v1/artists'))
        .send({ Name: 'Artista Efímero' })
        .expect(201);
      const artistId = (artist.body as { ArtistId: number }).ArtistId;
      const created = await createAlbum({ Title: 'Único', ArtistId: artistId });

      await asAdmin(http().delete(`/api/v1/artists/${artistId}`)).expect(409);
      await asAdmin(http().delete(`${BASE}/${created.AlbumId}`)).expect(204);
      await asAdmin(http().delete(`/api/v1/artists/${artistId}`)).expect(204);
    });
  });
});
