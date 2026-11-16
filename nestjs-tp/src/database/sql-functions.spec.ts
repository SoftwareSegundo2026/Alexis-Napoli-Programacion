import { DataSource } from 'typeorm';
import { registerSqlFunctions, unicodeLower } from './sql-functions.js';

describe('unicodeLower (spec 005 RF-7)', () => {
  it.each([
    ['CANCIÓN ÑANDÚ', 'canción ñandú'],
    ['BJÖRK', 'björk'],
    ['ÉMILE', 'émile'],
    ['AC/DC', 'ac/dc'],
  ])('%j → %j (también las letras no ASCII)', (input, expected) => {
    expect(unicodeLower(input)).toBe(expected);
  });

  it('no quita acentos: "Canción" y "Cancion" siguen distintos (caso 11)', () => {
    expect(unicodeLower('Canción')).not.toBe(unicodeLower('Cancion'));
  });

  it('ß y SS quedan distintas, sin depender de la configuración regional (caso 19)', () => {
    expect(unicodeLower('Straße')).toBe('straße');
    expect(unicodeLower('STRASSE')).toBe('strasse');
  });

  it('lo que no es texto se devuelve igual', () => {
    expect(unicodeLower(null)).toBeNull();
    expect(unicodeLower(7)).toBe(7);
  });
});

describe('registerSqlFunctions (contra un SQLite real en memoria)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Misma opción que usa DatabaseModule: así se prueba el registro real.
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      prepareDatabase: registerSqlFunctions,
    });
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('SQLite ejecuta unicode_lower donde LOWER() no alcanza', async () => {
    // (Alias `empty` y no `nothing`: NOTHING es palabra reservada de SQLite.)
    const rows: Array<{ ours: string; builtin: string; empty: null }> =
      await dataSource.query(
        "SELECT unicode_lower('CANCIÓN ÑANDÚ') AS ours, LOWER('CANCIÓN ÑANDÚ') AS builtin, unicode_lower(NULL) AS empty",
      );

    expect(rows[0]).toEqual({
      ours: 'canción ñandú',
      // Esto ES el bug 2: el LOWER() de SQLite deja las mayúsculas no ASCII.
      builtin: 'canciÓn ÑandÚ',
      empty: null,
    });
  });
});
