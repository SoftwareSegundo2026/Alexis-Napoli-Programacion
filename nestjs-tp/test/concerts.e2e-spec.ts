import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

interface ConcertBody {
  ConcertId: number;
  ArtistId: number;
  ArtistName: string | null;
  Title: string;
  StartsAt: string;
  Capacity: number;
  Price: number;
  Available: number;
}

interface ErrorBody {
  detail: string;
}

const CONCERTS = '/api/v1/concerts';
const FUTURE = '2099-06-01T21:00:00-03:00';

const valid = (overrides: Record<string, unknown> = {}) => ({
  ArtistId: 1,
  Title: 'Gira de prueba',
  StartsAt: FUTURE,
  Capacity: 100,
  Price: 25.5,
  ...overrides,
});

/** Conciertos (spec 004 RF-1, RF-2, RF-14). */
describe('Conciertos (e2e, spec 004)', () => {
  let app: INestApplication<App>;
  let adminToken = '';
  let viewerToken = '';

  beforeAll(async () => {
    app = await createTestApp();
    const users = await seedTestUsers(app);
    adminToken = users.adminToken;
    viewerToken = users.viewerToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const asAdmin = (test: request.Test) =>
    test.set('Authorization', bearer(adminToken));

  async function createConcert(
    overrides: Record<string, unknown> = {},
  ): Promise<ConcertBody> {
    const response = await asAdmin(http().post(CONCERTS))
      .send(valid(overrides))
      .expect(201);
    return response.body as ConcertBody;
  }

  it('alta válida → 201 con el artista, la fecha en UTC y disponibilidad = capacidad (RF-1, RF-2)', async () => {
    const concert = await createConcert();

    expect(concert).toEqual({
      ConcertId: expect.any(Number) as number,
      ArtistId: 1,
      ArtistName: 'AC/DC',
      Title: 'Gira de prueba',
      StartsAt: '2099-06-02T00:00:00.000Z',
      Capacity: 100,
      Price: 25.5,
      Available: 100,
    });
  });

  it('GET por id y listado lo muestran, también sin credencial (públicos)', async () => {
    const concert = await createConcert({ Title: 'Para listar' });

    const one = await http()
      .get(`${CONCERTS}/${concert.ConcertId}`)
      .expect(200);
    const list = await http().get(CONCERTS).expect(200);

    expect(one.body).toEqual(concert);
    expect((list.body as ConcertBody[]).map((c) => c.ConcertId)).toContain(
      concert.ConcertId,
    );
  });

  it('el listado se ordena por fecha', async () => {
    await createConcert({
      Title: 'Más tarde',
      StartsAt: '2099-12-01T00:00:00Z',
    });
    await createConcert({ Title: 'Antes', StartsAt: '2098-01-01T00:00:00Z' });

    const list = (await http().get(CONCERTS).expect(200)).body as ConcertBody[];
    const dates = list.map((c) => c.StartsAt);

    expect(dates).toEqual([...dates].sort());
  });

  it('concierto inexistente → 404', async () => {
    await http().get(`${CONCERTS}/999999`).expect(404);
  });

  it.each([
    ['StartsAt', { StartsAt: '2020-01-01T00:00:00Z' }], // en el pasado
    ['StartsAt', { StartsAt: '2099-06-01T21:00:00' }], // sin zona (caso 24)
    ['StartsAt', { StartsAt: 'mañana' }],
    ['ArtistId', { ArtistId: 999999 }], // artista inexistente
    ['Title', { Title: '   ' }],
    ['Capacity', { Capacity: 0 }],
    ['Capacity', { Capacity: 1.5 }],
    ['Price', { Price: 1.999 }],
    ['Price', { Price: -1 }],
  ])('%s inválido %o → 400 que lo nombra', async (field, overrides) => {
    const response = await asAdmin(http().post(CONCERTS))
      .send(valid(overrides))
      .expect(400);

    expect((response.body as ErrorBody).detail).toContain(field);
  });

  it('sin credencial → 401; viewer → 403 (caso 17)', async () => {
    await http().post(CONCERTS).send(valid()).expect(401);
    await http()
      .post(CONCERTS)
      .set('Authorization', bearer(viewerToken))
      .send(valid())
      .expect(403);
  });

  it('borrar un artista con conciertos y sin álbumes → 409 (RF-14, caso 26)', async () => {
    const artist = await asAdmin(http().post('/api/v1/artists'))
      .send({ Name: 'Artista con concierto T4' })
      .expect(201);
    const artistId = (artist.body as { ArtistId: number }).ArtistId;
    await createConcert({ ArtistId: artistId });

    const response = await asAdmin(
      http().delete(`/api/v1/artists/${artistId}`),
    ).expect(409);

    expect((response.body as ErrorBody).detail).toMatch(/concert/);
    await http().get(`/api/v1/artists/${artistId}`).expect(200);
  });
});
