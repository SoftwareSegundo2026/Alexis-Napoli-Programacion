import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareDatabase } from './prepare-database.js';

describe('prepareDatabase (RNF-4)', () => {
  let directory: string;
  let templatePath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'prepare-database-'));
    templatePath = join(directory, 'template.db');
    writeFileSync(templatePath, 'contenido del template');
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('si la base no existe la crea copiando el template (y su carpeta)', () => {
    const databasePath = join(directory, 'subcarpeta', 'trabajo.db');

    prepareDatabase(databasePath, templatePath);

    expect(readFileSync(databasePath, 'utf8')).toBe('contenido del template');
  });

  it('si la base ya existe no la pisa (conserva los datos de trabajo)', () => {
    const databasePath = join(directory, 'trabajo.db');
    writeFileSync(databasePath, 'datos de trabajo');

    prepareDatabase(databasePath, templatePath);

    expect(readFileSync(databasePath, 'utf8')).toBe('datos de trabajo');
  });

  it('nunca modifica el template', () => {
    prepareDatabase(join(directory, 'trabajo.db'), templatePath);

    expect(readFileSync(templatePath, 'utf8')).toBe('contenido del template');
  });

  it('falla con un mensaje claro si falta el template', () => {
    const databasePath = join(directory, 'trabajo.db');

    expect(() =>
      prepareDatabase(databasePath, join(directory, 'no-existe.db')),
    ).toThrow(/plantilla/);
    expect(existsSync(databasePath)).toBe(false);
  });
});
