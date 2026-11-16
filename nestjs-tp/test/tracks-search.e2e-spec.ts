import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

interface TrackItem {
  TrackId: number;
  Name: string;
  Composer: string | null;
  AlbumId: number | null;
  GenreId: number | null;
  GenreName: string | null;
  UnitPrice: number;
  Milliseconds: number;
}

interface SearchBody {
  items: TrackItem[];
  total: number;
  skip: number;
  limit: number;
  hasMore: boolean;
}

interface ErrorBody {
  detail: string;
}

const SEARCH = '/api/v1/tracks/search';
/** Pistas de la Chinook original. */
const ORIGINAL_TRACKS = 3503;
/** Álbumes de AC/DC (ArtistId 1) en la Chinook original. */
const ACDC_ALBUMS = [1, 4];

/** Pistas propias para los casos que la Chinook original no trae (sin álbum ni género). */
const SEEDED = [
  '100% Pura E2E',
  '100 Pura E2E',
  'Canción Ñandú E2E',
  'Sin Género E2E',
  'qzx b',
  'QZX a',
  'qzx C',
];

/**
 * Buscador de pistas por HTTP (spec 003): los 21 casos límite de la spec y la
 * documentación de los parámetros (RF-12).
 */
describe('GET /tracks/search (e2e, spec 003)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
    const { adminToken } = await seedTestUsers(app);
    for (const Name of SEEDED) {
      await request(app.getHttpServer())
        .post('/api/v1/tracks')
        .set('Authorization', bearer(adminToken))
        .send({ Name, MediaTypeId: 1, Milliseconds: 1000, UnitPrice: 0.5 })
        .expect(201);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const search = (query: Record<string, string | number> | string) =>
    request(app.getHttpServer()).get(SEARCH).query(query);

  async function ok(
    query: Record<string, string | number> | string,
  ): Promise<SearchBody> {
    const response = await search(query).expect(200);
    return response.body as SearchBody;
  }

  async function badRequest(
    query: Record<string, string | number> | string,
    param: string,
  ): Promise<void> {
    const response = await search(query).expect(400);
    expect((response.body as ErrorBody).detail).toMatch(
      new RegExp(`^${param} `),
    );
  }

  it('1. sin coincidencias → 200, items vacío y metadatos en 0', async () => {
    await expect(ok({ q: 'zzzz-no-existe-zzzz' })).resolves.toEqual({
      items: [],
      total: 0,
      skip: 0,
      limit: 100,
      hasMore: false,
    });
  });

  it('2. skip mayor que el total → 200, items vacío y el total real', async () => {
    const body = await ok({ genreId: 1, skip: 100000 });

    expect(body.items).toEqual([]);
    expect(body.total).toBeGreaterThan(0);
    expect(body.hasMore).toBe(false);
  });

  it('3. los 5 filtros a la vez → solo lo que cumple todos', async () => {
    const body = await ok({
      q: 'a',
      genreId: 1,
      artistId: 1,
      minPrice: '0.99',
      maxPrice: '0.99',
      minMs: 200000,
      maxMs: 400000,
    });

    expect(body.total).toBeGreaterThan(0);
    for (const track of body.items) {
      const text = `${track.Name} ${track.Composer ?? ''}`.toLowerCase();
      expect(text).toContain('a');
      expect(track.GenreId).toBe(1);
      expect(ACDC_ALBUMS).toContain(track.AlbumId);
      expect(track.UnitPrice).toBe(0.99);
      expect(track.Milliseconds).toBeGreaterThanOrEqual(200000);
      expect(track.Milliseconds).toBeLessThanOrEqual(400000);
    }
  });

  it.each([
    [{ sort: 'campo_hackers' }, 'sort'],
    [{ order: 'arriba' }, 'order'],
  ])('4. %o → 400 que nombra el parámetro', async (query, param) => {
    await badRequest(query, param);
  });

  it('5. q con % se busca literalmente (no es comodín)', async () => {
    const names = (await ok({ q: '100%' })).items.map((track) => track.Name);

    expect(names).toContain('100% Pura E2E');
    expect(names).not.toContain('100 Pura E2E');
  });

  it("5. q con ' y con acentos no rompe la consulta", async () => {
    await expect(ok({ q: "O'Neil" })).resolves.toMatchObject({ total: 0 });
    const accented = await ok({ q: 'Ñandú' });
    expect(accented.items.map((track) => track.Name)).toEqual([
      'Canción Ñandú E2E',
    ]);
  });

  it.each(["' OR 1=1 --", "%' OR '1'='1", "'); DROP TABLE Track; --"])(
    '6. q=%j es texto: 200, sin resultados de más',
    async (q) => {
      await expect(ok({ q })).resolves.toMatchObject({ total: 0, items: [] });
      // La tabla sigue ahí y entera.
      await expect(ok({})).resolves.toMatchObject({
        total: ORIGINAL_TRACKS + SEEDED.length,
      });
    },
  );

  it('7. una pista sin género aparece si no se filtra por género', async () => {
    const body = await ok({ q: 'sin género e2e' });

    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({ GenreId: null, GenreName: null });
  });

  it('8. limit=999999 → 400 (tope de 100)', async () => {
    await badRequest({ limit: 999999 }, 'limit');
  });

  it.each(['-1', 'abc'])('9. skip=%s → 400', async (skip) => {
    await badRequest({ skip }, 'skip');
  });

  it('10. sin ningún filtro → la primera página de todas', async () => {
    const body = await ok({});

    expect(body.total).toBe(ORIGINAL_TRACKS + SEEDED.length);
    expect(body.items).toHaveLength(100);
    expect(body.items[0].TrackId).toBe(1);
    expect(body.hasMore).toBe(true);
  });

  it('11. minPrice mayor que maxPrice → 400', async () => {
    await badRequest({ minPrice: '2', maxPrice: '1' }, 'maxPrice');
  });

  it.each<Record<string, number>>([{ genreId: 999999 }, { artistId: 999999 }])(
    '12. %o inexistente → 200 con items vacío',
    async (query) => {
      await expect(ok(query)).resolves.toMatchObject({ items: [], total: 0 });
    },
  );

  it.each(['', '   '])('13. q=%j → 400', async (q) => {
    await badRequest({ q }, 'q');
  });

  it('14. q=HIGHWAY y q=highway dan los mismos resultados', async () => {
    const upper = await ok({ q: 'HIGHWAY' });
    const lower = await ok({ q: 'highway' });

    expect(upper.total).toBeGreaterThan(0);
    expect(upper.items.map((t) => t.TrackId)).toEqual(
      lower.items.map((t) => t.TrackId),
    );
  });

  it('15. orden con empates: dos páginas seguidas = una página doble, sin repetidos', async () => {
    const query = { sort: 'unitPrice', order: 'desc' };
    const first = await ok({ ...query, skip: 0, limit: 50 });
    const second = await ok({ ...query, skip: 50, limit: 50 });
    const both = await ok({ ...query, skip: 0, limit: 100 });

    const ids = [...first.items, ...second.items].map((t) => t.TrackId);
    expect(ids).toEqual(both.items.map((t) => t.TrackId));
    expect(new Set(ids).size).toBe(100);
  });

  it('16. con una credencial inválida → se ignora (endpoint público): 200', async () => {
    await search({ q: 'love' })
      .set('Authorization', 'Bearer credencial-basura')
      .expect(200);
  });

  it('17. minPrice igual a maxPrice → el precio exacto', async () => {
    const body = await ok({ minPrice: '0.99', maxPrice: '0.99', limit: 100 });

    expect(body.total).toBeGreaterThan(0);
    expect(body.items.every((track) => track.UnitPrice === 0.99)).toBe(true);
  });

  it('18. parámetro repetido → 400 que lo nombra', async () => {
    await badRequest('genreId=1&genreId=2', 'genreId');
  });

  it('19. skip enorme → 200, items vacío y el skip ya topado', async () => {
    await expect(ok({ skip: '99999999999999999999' })).resolves.toMatchObject({
      items: [],
      skip: Number.MAX_SAFE_INTEGER,
      hasMore: false,
    });
  });

  it.each(['1,5', '1e2', '.5'])('20. minPrice=%s → 400', async (minPrice) => {
    await badRequest({ minPrice }, 'minPrice');
  });

  it('21. sort=name ordena sin distinguir mayúsculas', async () => {
    const body = await ok({ q: 'qzx', sort: 'name' });

    expect(body.items.map((track) => track.Name)).toEqual([
      'QZX a',
      'qzx b',
      'qzx C',
    ]);
  });

  it('RF-12: la documentación describe los 11 parámetros con su tipo', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    const document = response.body as {
      paths: Record<
        string,
        {
          get?: {
            parameters?: Array<{
              name: string;
              in: string;
              schema?: { type?: string };
            }>;
          };
        }
      >;
    };
    const parameters = document.paths[SEARCH]?.get?.parameters ?? [];
    const types = Object.fromEntries(
      parameters
        .filter((p) => p.in === 'query')
        .map((p) => [p.name, p.schema?.type]),
    );

    expect(types).toEqual({
      q: 'string',
      genreId: 'integer',
      artistId: 'integer',
      minPrice: 'number',
      maxPrice: 'number',
      minMs: 'integer',
      maxMs: 'integer',
      sort: 'string',
      order: 'string',
      skip: 'integer',
      limit: 'integer',
    });
  });
});
