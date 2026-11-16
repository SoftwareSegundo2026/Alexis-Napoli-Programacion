import { randomUUID } from 'node:crypto';
import { copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { TEMPLATE_DATABASE_PATH } from './database.module.js';
import { prepareConnection } from './prepare-connection.js';

/** Migración en código de la spec 004 (RNF-4), contra una copia REAL de la base. */
describe('runMigrations (vía prepareConnection)', () => {
  const databasePath = join(tmpdir(), `migrations-${randomUUID()}.db`);

  const open = async (): Promise<DataSource> => {
    const dataSource = new DataSource({
      type: 'better-sqlite3',
      database: databasePath,
      prepareDatabase: prepareConnection,
    });
    return dataSource.initialize();
  };

  beforeAll(() => {
    copyFileSync(TEMPLATE_DATABASE_PATH, databasePath);
  });

  afterAll(() => {
    rmSync(databasePath, { force: true });
  });

  it('crea las tablas Concert, Reservation y Payment', async () => {
    const dataSource = await open();
    const tables: Array<{ name: string }> = await dataSource.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('Concert', 'Reservation', 'Payment') ORDER BY name",
    );
    await dataSource.destroy();

    expect(tables.map((table) => table.name)).toEqual([
      'Concert',
      'Payment',
      'Reservation',
    ]);
  });

  it('es idempotente: abrir la base otra vez no falla ni duplica nada', async () => {
    const dataSource = await open();
    const objects: Array<{ total: number }> = await dataSource.query(
      "SELECT COUNT(*) AS total FROM sqlite_master WHERE tbl_name IN ('Concert', 'Reservation', 'Payment')",
    );
    await dataSource.destroy();
    const again = await open();
    const objectsAgain: Array<{ total: number }> = await again.query(
      "SELECT COUNT(*) AS total FROM sqlite_master WHERE tbl_name IN ('Concert', 'Reservation', 'Payment')",
    );
    await again.destroy();

    expect(objectsAgain[0].total).toBe(objects[0].total);
  });

  it('la clave de idempotencia es única por usuario (RF-6)', async () => {
    const dataSource = await open();
    try {
      // Dos usuarios REALES: las claves foráneas se hacen cumplir.
      const users: Array<{ id: number }> = await dataSource.query(
        'SELECT UserId AS id FROM User ORDER BY UserId LIMIT 2',
      );
      const [first, second] = users.map((user) => user.id);
      await dataSource.query(
        "INSERT INTO Concert (ArtistId, Title, StartsAt, Capacity, Price) VALUES (1, 'T', '2099-01-01T00:00:00.000Z', 10, 1)",
      );
      const insert = (userId: number) =>
        dataSource.query(
          "INSERT INTO Reservation (ConcertId, UserId, Quantity, Amount, Status, IdempotencyKey, CreatedAt) VALUES (1, ?, 1, 1, 'PAID', 'clave-repetida', '2026-01-01T00:00:00.000Z')",
          [userId],
        );

      await insert(first);
      await expect(insert(first)).rejects.toThrow(/UNIQUE/);
      // Otro usuario, misma clave: válido.
      await expect(insert(second)).resolves.toBeDefined();
    } finally {
      await dataSource.destroy();
    }
  });

  it('las claves foráneas se hacen cumplir: una reserva no puede apuntar a un usuario inexistente', async () => {
    const dataSource = await open();
    try {
      await expect(
        dataSource.query(
          "INSERT INTO Reservation (ConcertId, UserId, Quantity, Amount, Status, IdempotencyKey, CreatedAt) VALUES (1, 999999, 1, 1, 'PAID', 'otra-clave', '2026-01-01T00:00:00.000Z')",
        ),
      ).rejects.toThrow(/FOREIGN KEY/);
    } finally {
      await dataSource.destroy();
    }
  });

  it('la base sigue teniendo unicode_lower (las funciones SQL se registran igual)', async () => {
    const dataSource = await open();
    const rows: Array<{ lowered: string }> = await dataSource.query(
      "SELECT unicode_lower('ÑANDÚ') AS lowered",
    );
    await dataSource.destroy();

    expect(rows[0].lowered).toBe('ñandú');
  });
});
