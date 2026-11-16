import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { createTestApp } from './helpers/test-app.js';
import { TEMPLATE_DATABASE_PATH } from './helpers/test-env.js';

function fileHash(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('Base de datos (e2e) — RNF-4', () => {
  const templateHashBefore = fileHash(TEMPLATE_DATABASE_PATH);
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('la app trabaja sobre una copia temporal y no sobre el template', async () => {
    const rows: Array<{ file: string }> = await dataSource.query(
      "SELECT file FROM pragma_database_list WHERE name = 'main'",
    );
    const openedFile = resolve(rows[0].file);

    expect(openedFile).toBe(resolve(String(process.env.DATABASE_PATH)));
    expect(openedFile).not.toBe(resolve(TEMPLATE_DATABASE_PATH));
    expect(openedFile.startsWith(resolve(tmpdir()))).toBe(true);
  });

  it('la copia tiene los datos de Chinook', async () => {
    const rows: Array<{ total: number }> = await dataSource.query(
      'SELECT COUNT(*) AS total FROM Track',
    );

    expect(rows[0].total).toBe(3503);
  });

  it('escribir desde la app no modifica el template', async () => {
    await dataSource.query("INSERT INTO Genre (Name) VALUES ('Prueba RNF-4')");
    const rows: Array<{ total: number }> = await dataSource.query(
      "SELECT COUNT(*) AS total FROM Genre WHERE Name = 'Prueba RNF-4'",
    );

    expect(rows[0].total).toBe(1);
    expect(fileHash(TEMPLATE_DATABASE_PATH)).toBe(templateHashBefore);
  });
});
