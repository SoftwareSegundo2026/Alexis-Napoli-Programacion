import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';
import { TEST_WRITE_KEY } from './helpers/test-env.js';

interface TrackBody {
  TrackId: number;
  Name: string;
  AlbumId: number | null;
  MediaTypeId: number;
  GenreId: number | null;
  Composer: string | null;
  Milliseconds: number;
  Bytes: number | null;
  UnitPrice: number;
  AlbumTitle: string | null;
  GenreName: string | null;
  MediaTypeName: string | null;
}

interface ErrorBody {
  detail: string;
}

const BASE = '/api/v1/tracks';

const CONTRACT_KEYS = [
  'AlbumId',
  'AlbumTitle',
  'Bytes',
  'Composer',
  'GenreId',
  'GenreName',
  'MediaTypeId',
  'MediaTypeName',
  'Milliseconds',
  'Name',
  'TrackId',
  'UnitPrice',
];

const newTrack = {
  Name: 'Pista de Prueba',
  MediaTypeId: 1,
  Milliseconds: 180000,
  UnitPrice: 0.99,
};

describe('Pistas (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const withKey = (test: request.Test) => test.set('X-API-Key', TEST_WRITE_KEY);

  async function lastPageLength(): Promise<number> {
    const response = await http()
      .get(BASE)
      .query({ skip: 3500, limit: 100 })
      .expect(200);
    return (response.body as TrackBody[]).length;
  }

  async function createTrack(body: object): Promise<TrackBody> {
    const response = await withKey(http().post(BASE)).send(body).expect(201);
    return response.body as TrackBody;
  }

  describe('lectura (RF-1, RF-2, RF-3, RF-5)', () => {
    it('consulta por id con los datos enriquecidos y UnitPrice numérico', async () => {
      const response = await http().get(`${BASE}/1`).expect(200);
      const track = response.body as TrackBody;

      expect(Object.keys(track).sort()).toEqual(CONTRACT_KEYS);
      expect(track).toEqual({
        TrackId: 1,
        Name: 'For Those About To Rock (We Salute You)',
        AlbumId: 1,
        MediaTypeId: 1,
        GenreId: 1,
        Composer: 'Angus Young, Malcolm Young, Brian Johnson',
        Milliseconds: 343719,
        Bytes: 11170334,
        UnitPrice: 0.99,
        AlbumTitle: 'For Those About To Rock We Salute You 2',
        GenreName: 'Rock',
        MediaTypeName: 'MPEG audio file',
      });
    });

    it('lista 100 por defecto, ordenadas por id; la última página trae lo que queda', async () => {
      const first = await http().get(BASE).expect(200);
      const tracks = first.body as TrackBody[];
      expect(tracks).toHaveLength(100);
      expect(tracks[0].TrackId).toBe(1);
      expect(tracks[99].TrackId).toBe(100);
      expect(tracks.every((t) => typeof t.UnitPrice === 'number')).toBe(true);

      const last = await http()
        .get(BASE)
        .query({ skip: 3500, limit: 10 })
        .expect(200);
      expect((last.body as TrackBody[]).map((t) => t.TrackId)).toEqual([
        3501, 3502, 3503,
      ]);
    });

    it('id inexistente → 404; no entero → 400; paginación inválida → 400', async () => {
      await http()
        .get(`${BASE}/99999`)
        .expect(404, { detail: 'Track not found' });
      await http().get(`${BASE}/uno`).expect(400);
      await http().get(BASE).query({ limit: 0 }).expect(400);
    });
  });

  describe('alta (RF-5, RF-6, RF-9)', () => {
    it('crea con 201; sin álbum ni género → AlbumTitle y GenreName en null', async () => {
      const created = await createTrack(newTrack);

      expect(created).toEqual({
        TrackId: expect.any(Number),
        Name: 'Pista de Prueba',
        AlbumId: null,
        MediaTypeId: 1,
        GenreId: null,
        Composer: null,
        Milliseconds: 180000,
        Bytes: null,
        UnitPrice: 0.99,
        AlbumTitle: null,
        GenreName: null,
        MediaTypeName: 'MPEG audio file',
      });
      await http().get(`${BASE}/${created.TrackId}`).expect(200, created);
    });

    it('con todos los campos incluye los nombres derivados', async () => {
      const created = await createTrack({
        ...newTrack,
        AlbumId: 2,
        GenreId: 2,
        MediaTypeId: 2,
        Composer: ' Compositor ',
        Bytes: 1234,
        UnitPrice: 1.99,
      });

      expect(created).toEqual(
        expect.objectContaining({
          Composer: 'Compositor',
          Bytes: 1234,
          UnitPrice: 1.99,
          AlbumTitle: 'Balls to the Wall',
          GenreName: 'Jazz',
          MediaTypeName: 'Protected AAC audio file',
        }),
      );
    });

    it.each([
      [{ ...newTrack, MediaTypeId: 99 }, /MediaTypeId/],
      [{ ...newTrack, AlbumId: 99999 }, /AlbumId/],
      [{ ...newTrack, GenreId: 999 }, /GenreId/],
    ])(
      'id relacionado inexistente → 400 que lo nombra, y no guarda (%#)',
      async (body, field) => {
        const before = await lastPageLength();

        const response = await withKey(http().post(BASE))
          .send(body)
          .expect(400);

        expect((response.body as ErrorBody).detail).toMatch(field);
        expect(await lastPageLength()).toBe(before);
      },
    );

    it.each([
      [{ ...newTrack, Name: '  ' }, /Name/],
      [{ ...newTrack, Milliseconds: 0 }, /Milliseconds/],
      [{ ...newTrack, Bytes: -5 }, /Bytes/],
      [{ ...newTrack, UnitPrice: 0.999 }, /UnitPrice/],
      [{ ...newTrack, UnitPrice: -1 }, /UnitPrice/],
      [{ ...newTrack, TrackId: 1 }, /TrackId/],
    ])(
      'cuerpo inválido → 400 que nombra el campo (%#)',
      async (body, field) => {
        const response = await withKey(http().post(BASE))
          .send(body)
          .expect(400);

        expect((response.body as ErrorBody).detail).toMatch(field);
      },
    );
  });

  describe('modificación (RF-7, RF-9)', () => {
    it('cambia solo lo enviado y actualiza los nombres derivados', async () => {
      const created = await createTrack({
        ...newTrack,
        AlbumId: 1,
        GenreId: 1,
      });

      const response = await withKey(http().patch(`${BASE}/${created.TrackId}`))
        .send({ GenreId: 3, UnitPrice: 1.29 })
        .expect(200);

      expect(response.body).toEqual({
        ...created,
        GenreId: 3,
        GenreName: 'Metal',
        UnitPrice: 1.29,
      });
    });

    it('AlbumId en null quita el álbum → AlbumTitle null', async () => {
      const created = await createTrack({ ...newTrack, AlbumId: 1 });

      const response = await withKey(http().patch(`${BASE}/${created.TrackId}`))
        .send({ AlbumId: null })
        .expect(200);

      expect(response.body).toEqual(
        expect.objectContaining({ AlbumId: null, AlbumTitle: null }),
      );
    });

    it('id relacionado inexistente al modificar → 400 y no cambia nada', async () => {
      await withKey(http().patch(`${BASE}/2`))
        .send({ MediaTypeId: 99 })
        .expect(400);
      const response = await http().get(`${BASE}/2`).expect(200);
      expect((response.body as TrackBody).MediaTypeId).toBe(2);
    });

    it('{} → 200 sin cambios; obligatorio en null → 400; id inexistente → 404', async () => {
      const before = await http().get(`${BASE}/2`).expect(200);

      await withKey(http().patch(`${BASE}/2`))
        .send({})
        .expect(200, before.body as TrackBody);
      await withKey(http().patch(`${BASE}/2`))
        .send({ Milliseconds: null })
        .expect(400);
      await withKey(http().patch(`${BASE}/99999`))
        .send({ Name: 'Nadie' })
        .expect(404, { detail: 'Track not found' });
    });
  });

  describe('baja (RF-8, RF-12)', () => {
    it('una pista original (en facturas y playlists) → 409 que lo explica, y no se borra', async () => {
      const response = await withKey(http().delete(`${BASE}/1`)).expect(409);

      expect((response.body as ErrorBody).detail).toMatch(/invoice|playlist/);
      await http().get(`${BASE}/1`).expect(200);
    });

    it('una pista recién creada y sin referencias → 204 sin cuerpo; después 404', async () => {
      const created = await createTrack(newTrack);

      const response = await withKey(
        http().delete(`${BASE}/${created.TrackId}`),
      ).expect(204);

      expect(response.text).toBe('');
      await http().get(`${BASE}/${created.TrackId}`).expect(404);
    });

    it('al borrar la única pista de un álbum nuevo, el álbum se puede borrar', async () => {
      const album = await withKey(http().post('/api/v1/albums'))
        .send({ Title: 'Álbum Efímero', ArtistId: 1 })
        .expect(201);
      const albumId = (album.body as { AlbumId: number }).AlbumId;
      const created = await createTrack({ ...newTrack, AlbumId: albumId });

      await withKey(http().delete(`/api/v1/albums/${albumId}`)).expect(409);
      await withKey(http().delete(`${BASE}/${created.TrackId}`)).expect(204);
      await withKey(http().delete(`/api/v1/albums/${albumId}`)).expect(204);
    });
  });
});
