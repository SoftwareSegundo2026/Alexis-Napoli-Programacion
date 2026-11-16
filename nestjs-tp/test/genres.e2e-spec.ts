import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';
import { TEST_WRITE_KEY } from './helpers/test-env.js';

interface GenreBody {
  GenreId: number;
  Name: string | null;
}

interface ErrorBody {
  detail: string;
}

const BASE = '/api/v1/genres';

describe('Géneros (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const withKey = (test: request.Test) => test.set('X-API-Key', TEST_WRITE_KEY);

  async function countGenres(): Promise<number> {
    const response = await http().get(BASE).query({ limit: 100 }).expect(200);
    return (response.body as GenreBody[]).length;
  }

  async function createGenre(name: string): Promise<GenreBody> {
    const response = await withKey(http().post(BASE))
      .send({ Name: name })
      .expect(201);
    return response.body as GenreBody;
  }

  describe('lectura (RF-1, RF-2, RF-3)', () => {
    it('lista los géneros ordenados por id, con los campos del contrato', async () => {
      const response = await http().get(BASE).expect(200);
      const genres = response.body as GenreBody[];

      expect(genres).toHaveLength(25);
      expect(genres[0]).toEqual({ GenreId: 1, Name: 'Rock' });
      const ids = genres.map((genre) => genre.GenreId);
      expect(ids).toEqual([...ids].sort((a, b) => a - b));
    });

    it('respeta skip y limit', async () => {
      const response = await http()
        .get(BASE)
        .query({ skip: 2, limit: 3 })
        .expect(200);

      expect((response.body as GenreBody[]).map((g) => g.GenreId)).toEqual([
        3, 4, 5,
      ]);
    });

    it('skip mayor que el total → 200 con []', async () => {
      await http().get(BASE).query({ skip: 1000 }).expect(200, []);
    });

    it.each([{ limit: 0 }, { limit: 101 }, { limit: 'abc' }, { skip: -1 }])(
      'paginación inválida %j → 400 con detail (RF-10)',
      async (query) => {
        const response = await http().get(BASE).query(query).expect(400);
        expect(typeof (response.body as ErrorBody).detail).toBe('string');
      },
    );

    it('consulta por id', async () => {
      await http().get(`${BASE}/2`).expect(200, { GenreId: 2, Name: 'Jazz' });
    });

    it.each(['9999', '0', '-1'])(
      'id %s inexistente → 404 "Genre not found"',
      async (id) => {
        await http()
          .get(`${BASE}/${id}`)
          .expect(404, { detail: 'Genre not found' });
      },
    );

    it.each(['abc', '1.5'])('id no entero (%s) → 400', async (id) => {
      await http().get(`${BASE}/${id}`).expect(400);
    });
  });

  describe('alta (RF-6, RF-9, RF-13)', () => {
    it('crea con 201, recorta espacios y queda persistido', async () => {
      const created = await createGenre('  Cumbia  ');

      expect(created).toEqual({ GenreId: expect.any(Number), Name: 'Cumbia' });
      await http().get(`${BASE}/${created.GenreId}`).expect(200, created);
    });

    it.each([
      [{}, /Name/],
      [{ Name: '   ' }, /Name/],
      [{ Name: 'x'.repeat(121) }, /Name/],
      [{ Name: 42 }, /Name/],
      [{ Name: 'Válido', Foo: 1 }, /Foo/],
    ])(
      'cuerpo inválido %j → 400 que nombra el campo y no guarda',
      async (body, field) => {
        const before = await countGenres();

        const response = await withKey(http().post(BASE))
          .send(body)
          .expect(400);

        expect((response.body as ErrorBody).detail).toMatch(field);
        expect(await countGenres()).toBe(before);
      },
    );

    it.each(['Rock', 'rock', '  ROCK  '])(
      'nombre repetido "%s" (sin distinguir mayúsculas ni espacios) → 409',
      async (name) => {
        const before = await countGenres();

        const response = await withKey(http().post(BASE))
          .send({ Name: name })
          .expect(409);

        expect(typeof (response.body as ErrorBody).detail).toBe('string');
        expect(await countGenres()).toBe(before);
      },
    );

    it('sin clave → 401 y no guarda (RF-11)', async () => {
      const before = await countGenres();

      await http().post(BASE).send({ Name: 'Sin Clave' }).expect(401);

      expect(await countGenres()).toBe(before);
    });
  });

  describe('modificación (RF-7, RF-9, RF-13)', () => {
    it('cambia el nombre y responde 200 con el género actualizado', async () => {
      const created = await createGenre('Para Renombrar');

      await withKey(http().patch(`${BASE}/${created.GenreId}`))
        .send({ Name: 'Renombrado' })
        .expect(200, { GenreId: created.GenreId, Name: 'Renombrado' });
      await http()
        .get(`${BASE}/${created.GenreId}`)
        .expect(200, { GenreId: created.GenreId, Name: 'Renombrado' });
    });

    it('cuerpo vacío {} → 200 y el género queda igual', async () => {
      await withKey(http().patch(`${BASE}/3`))
        .send({})
        .expect(200, { GenreId: 3, Name: 'Metal' });
    });

    it('reenviar su propio nombre no es conflicto → 200', async () => {
      await withKey(http().patch(`${BASE}/3`))
        .send({ Name: 'Metal' })
        .expect(200, { GenreId: 3, Name: 'Metal' });
    });

    it('el nombre de OTRO género → 409', async () => {
      await withKey(http().patch(`${BASE}/3`))
        .send({ Name: 'jazz' })
        .expect(409);
      await http().get(`${BASE}/3`).expect(200, { GenreId: 3, Name: 'Metal' });
    });

    it('Name en null → 400', async () => {
      const response = await withKey(http().patch(`${BASE}/3`))
        .send({ Name: null })
        .expect(400);
      expect((response.body as ErrorBody).detail).toMatch(/Name/);
    });

    it('id inexistente → 404', async () => {
      await withKey(http().patch(`${BASE}/9999`))
        .send({ Name: 'Nadie' })
        .expect(404, { detail: 'Genre not found' });
    });

    it('id inexistente y cuerpo inválido → 400 (la validación va antes que el 404)', async () => {
      await withKey(http().patch(`${BASE}/9999`))
        .send({ Name: '' })
        .expect(400);
    });
  });

  describe('baja (RF-8, RF-12)', () => {
    it('un género que usan pistas → 409 que explica la causa, y no se borra', async () => {
      const response = await withKey(http().delete(`${BASE}/1`)).expect(409);

      expect((response.body as ErrorBody).detail).toMatch(/track/);
      await http().get(`${BASE}/1`).expect(200);
    });

    it('un género sin pistas → 204 sin cuerpo; después 404', async () => {
      const created = await createGenre('Para Borrar');

      const response = await withKey(
        http().delete(`${BASE}/${created.GenreId}`),
      ).expect(204);

      expect(response.text).toBe('');
      await http().get(`${BASE}/${created.GenreId}`).expect(404);
      await withKey(http().delete(`${BASE}/${created.GenreId}`)).expect(404);
    });
  });
});
