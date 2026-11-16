import { randomUUID } from 'node:crypto';
import { copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, type Logger } from 'typeorm';
import { Album } from '../albums/entities/album.entity.js';
import { Artist } from '../artists/entities/artist.entity.js';
import { TEMPLATE_DATABASE_PATH } from '../database/database.module.js';
import { registerSqlFunctions } from '../database/sql-functions.js';
import { Genre } from '../genres/entities/genre.entity.js';
import { InvoiceLine } from './entities/invoice-line.entity.js';
import { MediaType } from './entities/media-type.entity.js';
import { PlaylistTrack } from './entities/playlist-track.entity.js';
import { Track } from './entities/track.entity.js';
import {
  TracksRepository,
  type TrackSearchFilters,
} from './tracks.repository.js';

/** Guarda cada consulta que ejecuta TypeORM, para inspeccionar el SQL (RNF-1, RNF-3). */
class RecordingLogger implements Logger {
  readonly queries: Array<{ sql: string; parameters: unknown[] }> = [];
  logQuery(sql: string, parameters?: unknown[]): void {
    this.queries.push({ sql, parameters: parameters ?? [] });
  }
  logQueryError(): void {}
  logQuerySlow(): void {}
  logSchemaBuild(): void {}
  logMigration(): void {}
  log(): void {}
}

/** Una fila de la base, tal como la usa el oráculo. */
interface Row {
  id: number;
  name: string;
  composer: string | null;
  genreId: number | null;
  artistId: number | null;
  unitPrice: number;
  milliseconds: number;
}

const DEFAULTS: TrackSearchFilters = {
  sort: 'trackId',
  order: 'asc',
  skip: 0,
  limit: 100,
};

/**
 * Búsqueda de pistas contra una copia REAL de la base (spec 003): el SQL es
 * propio (filtros, LIKE con escape, orden, paginación), y un mock no probaría que
 * sea correcto. Los resultados se comparan con un ORÁCULO: la misma búsqueda
 * resuelta en memoria, de la forma más simple, a partir de todas las filas.
 */
describe('TracksRepository.search (contra una copia de la base)', () => {
  const databasePath = join(tmpdir(), `tracks-search-${randomUUID()}.db`);
  const logger = new RecordingLogger();
  let dataSource: DataSource;
  let repository: TracksRepository;
  let rows: Row[];

  beforeAll(async () => {
    copyFileSync(TEMPLATE_DATABASE_PATH, databasePath);
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: databasePath,
      entities: [
        Track,
        Album,
        Artist,
        Genre,
        MediaType,
        InvoiceLine,
        PlaylistTrack,
      ],
      synchronize: false,
      // La misma opción que DatabaseModule: registra unicode_lower.
      prepareDatabase: registerSqlFunctions,
      logging: true,
      logger,
    });
    await dataSource.initialize();
    repository = new TracksRepository(
      dataSource.getRepository(Track),
      dataSource.getRepository(MediaType),
      dataSource.getRepository(InvoiceLine),
      dataSource.getRepository(PlaylistTrack),
    );

    // Pistas propias para los casos que la Chinook original no trae.
    for (const name of [
      '100% Pura T3',
      '100 Pura T3',
      'a_b T3',
      'axb T3',
      'Canción Ñandú T3',
    ]) {
      await repository.create({
        name,
        albumId: null, // sin álbum y sin género: relaciones vacías (RF-10)
        mediaTypeId: 1,
        genreId: null,
        composer: null,
        milliseconds: 1000,
        bytes: null,
        unitPrice: 0.5,
      });
    }

    rows = await dataSource.query(
      `SELECT t.TrackId AS id, t.Name AS name, t.Composer AS composer,
              t.GenreId AS genreId, a.ArtistId AS artistId,
              t.UnitPrice AS unitPrice, t.Milliseconds AS milliseconds
         FROM Track t LEFT JOIN Album a ON a.AlbumId = t.AlbumId`,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
    rmSync(databasePath, { force: true });
  });

  /** El oráculo: qué ids deberían salir, filtrando y ordenando en memoria. */
  function expected(filters: TrackSearchFilters): {
    ids: number[];
    total: number;
  } {
    const q = filters.q?.toLowerCase();
    const matching = rows.filter(
      (row) =>
        (q === undefined ||
          row.name.toLowerCase().includes(q) ||
          (row.composer?.toLowerCase().includes(q) ?? false)) &&
        (filters.genreId === undefined || row.genreId === filters.genreId) &&
        (filters.artistId === undefined || row.artistId === filters.artistId) &&
        (filters.minPrice === undefined || row.unitPrice >= filters.minPrice) &&
        (filters.maxPrice === undefined || row.unitPrice <= filters.maxPrice) &&
        (filters.minMs === undefined || row.milliseconds >= filters.minMs) &&
        (filters.maxMs === undefined || row.milliseconds <= filters.maxMs),
    );
    const key = (row: Row): string | number =>
      filters.sort === 'name'
        ? row.name.toLowerCase()
        : filters.sort === 'unitPrice'
          ? row.unitPrice
          : filters.sort === 'milliseconds'
            ? row.milliseconds
            : row.id;
    const direction = filters.order === 'desc' ? -1 : 1;
    matching.sort((a, b) => {
      const [ka, kb] = [key(a), key(b)];
      if (ka !== kb) return (ka < kb ? -1 : 1) * direction;
      return a.id - b.id; // desempate estable (RF-5)
    });
    return {
      ids: matching
        .slice(filters.skip, filters.skip + filters.limit)
        .map((r) => r.id),
      total: matching.length,
    };
  }

  async function search(partial: Partial<TrackSearchFilters>) {
    const filters = { ...DEFAULTS, ...partial };
    const { items, total } = await repository.search(filters);
    return { ids: items.map((track) => track.id), total, items, filters };
  }

  it('sin filtros: la primera página de todas, en orden de id (RF-1, caso 10)', async () => {
    const result = await search({});

    expect(result.total).toBe(rows.length);
    expect(result.ids).toEqual(expected(result.filters).ids);
    expect(result.ids).toHaveLength(100);
  });

  it.each<[string, Partial<TrackSearchFilters>]>([
    ['texto', { q: 'love' }],
    ['género', { genreId: 1 }],
    ['artista (vía álbum)', { artistId: 1 }],
    ['precio exacto', { minPrice: 1.99, maxPrice: 1.99 }],
    ['rango de duración', { minMs: 120000, maxMs: 180000 }],
    ['solo mínimo de precio', { minPrice: 1 }],
    ['solo máximo de duración', { maxMs: 60000 }],
  ])(
    'filtro de %s: coincide con el oráculo (RF-2 a RF-4)',
    async (_label, filters) => {
      const result = await search({ ...filters, limit: 100 });
      const oracle = expected(result.filters);

      expect(result.total).toBe(oracle.total);
      expect(result.ids).toEqual(oracle.ids);
      expect(oracle.total).toBeGreaterThan(0); // el caso tiene que probar algo
    },
  );

  it('los 5 filtros a la vez: solo lo que cumple todos (RF-3, caso 3)', async () => {
    const result = await search({
      q: 'a',
      genreId: 1,
      artistId: 1,
      minPrice: 0.99,
      maxPrice: 0.99,
      minMs: 200000,
      maxMs: 400000,
    });
    const oracle = expected(result.filters);

    expect(oracle.total).toBeGreaterThan(0);
    expect(result.total).toBe(oracle.total);
    expect(result.ids).toEqual(oracle.ids);
  });

  it('sin coincidencias → items vacío y total 0 (caso 1)', async () => {
    await expect(search({ q: 'zzzz-no-existe-zzzz' })).resolves.toMatchObject({
      ids: [],
      total: 0,
    });
  });

  it('skip mayor que el total → items vacío y el total real (caso 2)', async () => {
    const result = await search({ genreId: 1, skip: 100000 });

    expect(result.ids).toEqual([]);
    expect(result.total).toBe(expected(result.filters).total);
  });

  it('skip enorme (ya topado por el DTO) no rompe la consulta', async () => {
    await expect(
      search({ skip: Number.MAX_SAFE_INTEGER }),
    ).resolves.toMatchObject({
      ids: [],
      total: rows.length,
    });
  });

  it.each([{ genreId: 999999 }, { artistId: 999999 }])(
    '%o inexistente → items vacío, no error (RF-11, caso 12)',
    async (filters) => {
      await expect(search(filters)).resolves.toMatchObject({
        ids: [],
        total: 0,
      });
    },
  );

  it('una pista sin género ni álbum aparece si no se filtra por ellos (RF-10, caso 7)', async () => {
    const result = await search({ q: 'pura t3' });

    expect(result.total).toBe(2);
    expect(result.items.every((track) => track.genreId === null)).toBe(true);
  });

  it('una pista sin álbum no coincide con ningún artista (RF-4)', async () => {
    await expect(search({ q: 'pura t3', artistId: 1 })).resolves.toMatchObject({
      total: 0,
    });
  });

  it('el texto no distingue mayúsculas en ninguna letra (RF-2, caso 14)', async () => {
    const lower = await search({ q: 'highway' });
    const upper = await search({ q: 'HIGHWAY' });
    const accented = await search({ q: 'CANCIÓN ÑANDÚ' });

    expect(upper.ids).toEqual(lower.ids);
    expect(lower.total).toBeGreaterThan(0);
    expect(accented.total).toBe(1);
  });

  it('los acentos distinguen: "cancion" no encuentra "Canción" (RF-2)', async () => {
    await expect(search({ q: 'cancion ñandú t3' })).resolves.toMatchObject({
      total: 0,
    });
  });

  it.each<[string, string, string]>([
    // % literal: encuentra "100% Pura T3" (y "100% HardCore", que trae Chinook),
    // pero NO "100 Pura T3", que solo coincidiría si % fuera comodín.
    ['100%', '100% Pura T3', '100 Pura T3'],
    // _ literal: encuentra "a_b T3" pero NO "axb T3".
    ['a_b', 'a_b T3', 'axb T3'],
  ])(
    'q=%j se busca literalmente (RF-8, caso 5)',
    async (q, mustAppear, mustNotAppear) => {
      const result = await search({ q });
      const names = result.items.map((track) => track.name);

      expect(names).toContain(mustAppear);
      expect(names).not.toContain(mustNotAppear);
      expect(result.ids).toEqual(expected(result.filters).ids);
    },
  );

  it.each([
    "' OR 1=1 --",
    "%' OR '1'='1",
    "'); DROP TABLE Track; --",
    "O'Neil",
  ])('q=%j es texto: sin error ni datos de más (RF-8, caso 6)', async (q) => {
    const result = await search({ q });

    expect(result.total).toBe(expected(result.filters).total);
    expect(result.total).toBeLessThan(rows.length);
  });

  it.each<[TrackSearchFilters['sort'], TrackSearchFilters['order']]>([
    ['unitPrice', 'desc'],
    ['unitPrice', 'asc'],
    ['milliseconds', 'asc'],
    ['milliseconds', 'desc'],
    ['name', 'asc'],
    ['name', 'desc'],
    ['trackId', 'desc'],
  ])(
    'sort=%s order=%s: orden y desempate por id iguales al oráculo (RF-5, casos 15 y 21)',
    async (sort, order) => {
      const result = await search({ sort, order, skip: 50, limit: 100 });

      expect(result.ids).toEqual(expected(result.filters).ids);
    },
  );

  it('pagina y cuenta EN LA BASE, con el texto solo como parámetro (RNF-1, RNF-3)', async () => {
    logger.queries.length = 0;

    await search({ q: 'zzz%_unico', skip: 10, limit: 5 });

    const selects = logger.queries.filter((query) =>
      query.sql.startsWith('SELECT'),
    );
    const page = selects.find((query) => /\bLIMIT\b/.test(query.sql));
    const count = selects.find((query) => /COUNT\(/.test(query.sql));
    expect(page?.sql).toMatch(/\bLIMIT 5\b/);
    expect(page?.sql).toMatch(/\bOFFSET 10\b/);
    expect(count).toBeDefined();
    for (const query of selects) {
      expect(query.sql).not.toContain('zzz');
    }
    expect(page?.parameters).toContain('%zzz\\%\\_unico%');
  });

  // Spec 003 RNF-3 (precisado en la validación): TODO valor de filtro, también
  // los números, viaja como parámetro. El driver de SQLite de TypeORM escribe
  // como literal cualquier parámetro `number`; este test lo detecta.
  it('ningún valor de filtro (texto ni números) aparece en el SQL ejecutado (RNF-3, T5)', async () => {
    const filters = {
      q: 'zzq',
      genreId: 13,
      artistId: 87,
      minPrice: 0.37,
      maxPrice: 1.73,
      minMs: 123457,
      maxMs: 987653,
    };
    logger.queries.length = 0;

    await search(filters);

    const selects = logger.queries.filter((query) =>
      query.sql.startsWith('SELECT'),
    );
    expect(selects.length).toBeGreaterThanOrEqual(2); // página y COUNT
    for (const query of selects) {
      for (const value of Object.values(filters)) {
        expect(query.sql).not.toContain(String(value));
      }
      for (const value of Object.values(filters).filter(
        (v) => typeof v === 'number',
      )) {
        expect(query.parameters).toContain(String(value));
      }
    }
  });
});
