import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';
import { TEST_WRITE_KEY } from './helpers/test-env.js';

interface ArtistBody {
  ArtistId: number;
  Name: string | null;
  ImageUrl: string | null;
}

interface ErrorBody {
  detail: string;
}

const BASE = '/api/v1/artists';

describe('Artistas (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const withKey = (test: request.Test) => test.set('X-API-Key', TEST_WRITE_KEY);

  async function totalArtists(): Promise<number> {
    let total = 0;
    for (let skip = 0; ; skip += 100) {
      const response = await http().get(BASE).query({ skip }).expect(200);
      const page = response.body as ArtistBody[];
      total += page.length;
      if (page.length < 100) {
        return total;
      }
    }
  }

  async function createArtist(body: object): Promise<ArtistBody> {
    const response = await withKey(http().post(BASE)).send(body).expect(201);
    return response.body as ArtistBody;
  }

  describe('lectura (RF-1, RF-2, RF-3)', () => {
    it('lista por defecto 100 artistas, ordenados por id, con los campos del contrato', async () => {
      const response = await http().get(BASE).expect(200);
      const artists = response.body as ArtistBody[];

      expect(artists).toHaveLength(100);
      expect(artists[0]).toEqual({
        ArtistId: 1,
        Name: 'AC/DC',
        ImageUrl: '/static/images/artists/1.jpg',
      });
      const ids = artists.map((artist) => artist.ArtistId);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    });

    it('respeta skip y limit (la última página trae lo que queda)', async () => {
      const response = await http()
        .get(BASE)
        .query({ skip: 270, limit: 100 })
        .expect(200);

      expect((response.body as ArtistBody[]).map((a) => a.ArtistId)).toEqual([
        271, 272, 273, 274, 275, 276, 277,
      ]);
    });

    it('paginación inválida → 400 (RF-10)', async () => {
      await http().get(BASE).query({ limit: 101 }).expect(400);
      await http().get(BASE).query({ skip: 'x' }).expect(400);
    });

    it('consulta por id; inexistente → 404; no entero → 400', async () => {
      await http().get(`${BASE}/2`).expect(200, {
        ArtistId: 2,
        Name: 'Accept',
        ImageUrl: '/static/images/artists/2.jpg',
      });
      await http()
        .get(`${BASE}/9999`)
        .expect(404, { detail: 'Artist not found' });
      await http().get(`${BASE}/abc`).expect(400);
    });
  });

  describe('alta (RF-6, RF-9, RF-13)', () => {
    it('crea con 201; ImageUrl es opcional y vale null si no viene', async () => {
      const created = await createArtist({ Name: '  Soda Stereo ' });

      expect(created).toEqual({
        ArtistId: expect.any(Number),
        Name: 'Soda Stereo',
        ImageUrl: null,
      });
      await http().get(`${BASE}/${created.ArtistId}`).expect(200, created);
    });

    it('guarda la ImageUrl si viene', async () => {
      const created = await createArtist({
        Name: 'Charly García',
        ImageUrl: '/static/images/artists/charly.jpg',
      });

      expect(created.ImageUrl).toBe('/static/images/artists/charly.jpg');
    });

    it.each([
      [{}, /Name/],
      [{ Name: '' }, /Name/],
      [{ Name: 'x'.repeat(121) }, /Name/],
      [{ Name: 'Válido', ImageUrl: 'x'.repeat(501) }, /ImageUrl/],
      [{ Name: 'Válido', ArtistId: 5 }, /ArtistId/],
    ])(
      'cuerpo inválido %j → 400 que nombra el campo y no guarda',
      async (body, field) => {
        const before = await totalArtists();

        const response = await withKey(http().post(BASE))
          .send(body)
          .expect(400);

        expect((response.body as ErrorBody).detail).toMatch(field);
        expect(await totalArtists()).toBe(before);
      },
    );

    it.each(['AC/DC', 'ac/dc', ' Ac/Dc '])(
      'nombre repetido "%s" → 409 y no guarda',
      async (name) => {
        const before = await totalArtists();

        await withKey(http().post(BASE)).send({ Name: name }).expect(409);

        expect(await totalArtists()).toBe(before);
      },
    );
  });

  describe('modificación (RF-7, RF-9, RF-13)', () => {
    it('cambia solo lo enviado y conserva el resto', async () => {
      const created = await createArtist({
        Name: 'Para Modificar',
        ImageUrl: '/img/original.jpg',
      });

      await withKey(http().patch(`${BASE}/${created.ArtistId}`))
        .send({ Name: 'Modificado' })
        .expect(200, {
          ArtistId: created.ArtistId,
          Name: 'Modificado',
          ImageUrl: '/img/original.jpg',
        });
    });

    it('ImageUrl en null quita la imagen', async () => {
      const created = await createArtist({
        Name: 'Sin Imagen Después',
        ImageUrl: '/img/x.jpg',
      });

      await withKey(http().patch(`${BASE}/${created.ArtistId}`))
        .send({ ImageUrl: null })
        .expect(200, {
          ArtistId: created.ArtistId,
          Name: 'Sin Imagen Después',
          ImageUrl: null,
        });
    });

    it('{} → 200 sin cambios; su propio nombre → 200; Name null → 400', async () => {
      const original = {
        ArtistId: 3,
        Name: 'Aerosmith',
        ImageUrl: '/static/images/artists/3.png',
      };

      await withKey(http().patch(`${BASE}/3`))
        .send({})
        .expect(200, original);
      await withKey(http().patch(`${BASE}/3`))
        .send({ Name: 'Aerosmith' })
        .expect(200, original);
      await withKey(http().patch(`${BASE}/3`))
        .send({ Name: null })
        .expect(400);
    });

    it('el nombre de OTRO artista → 409 y no cambia nada', async () => {
      await withKey(http().patch(`${BASE}/3`))
        .send({ Name: 'accept' })
        .expect(409);
      const response = await http().get(`${BASE}/3`).expect(200);
      expect((response.body as ArtistBody).Name).toBe('Aerosmith');
    });

    it('id inexistente → 404', async () => {
      await withKey(http().patch(`${BASE}/9999`))
        .send({ Name: 'Nadie' })
        .expect(404, { detail: 'Artist not found' });
    });
  });

  describe('baja (RF-8, RF-12)', () => {
    it('un artista con álbumes → 409 que lo explica, y no se borra', async () => {
      const response = await withKey(http().delete(`${BASE}/1`)).expect(409);

      expect((response.body as ErrorBody).detail).toMatch(/album/);
      await http().get(`${BASE}/1`).expect(200);
    });

    it('un artista sin álbumes → 204 sin cuerpo; después 404', async () => {
      const created = await createArtist({ Name: 'Para Borrar' });

      const response = await withKey(
        http().delete(`${BASE}/${created.ArtistId}`),
      ).expect(204);

      expect(response.text).toBe('');
      await http().get(`${BASE}/${created.ArtistId}`).expect(404);
    });

    it('id inexistente → 404', async () => {
      await withKey(http().delete(`${BASE}/9999`)).expect(404);
    });
  });
});
