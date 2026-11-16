import { randomUUID } from 'node:crypto';
import { copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { Artist } from '../artists/entities/artist.entity.js';
import { TEMPLATE_DATABASE_PATH } from '../database/database.module.js';
import { prepareConnection } from '../database/prepare-connection.js';
import { ConcertsRepository } from './concerts.repository.js';
import { ConcertResponseDto } from './dto/concert-response.dto.js';
import { Concert } from './entities/concert.entity.js';

/** Disponibilidad calculada (spec 004 RF-2), contra una copia REAL de la base. */
describe('ConcertsRepository (contra una copia de la base)', () => {
  const databasePath = join(tmpdir(), `concerts-repo-${randomUUID()}.db`);
  let dataSource: DataSource;
  let repository: ConcertsRepository;
  let userId: number;

  beforeAll(async () => {
    copyFileSync(TEMPLATE_DATABASE_PATH, databasePath);
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: databasePath,
      entities: [Concert, Artist],
      prepareDatabase: prepareConnection,
    });
    await dataSource.initialize();
    repository = new ConcertsRepository(dataSource.getRepository(Concert));
    const users: Array<{ id: number }> = await dataSource.query(
      'SELECT UserId AS id FROM User LIMIT 1',
    );
    userId = users[0].id;
  });

  afterAll(async () => {
    await dataSource.destroy();
    rmSync(databasePath, { force: true });
  });

  const newConcert = (startsAt: string, capacity = 10) =>
    repository.create({
      artistId: 1,
      title: `Concierto ${startsAt}`,
      startsAt,
      capacity,
      price: 2.5,
    });

  let key = 0;
  const reserve = (concertId: number, quantity: number, status: string) => {
    key += 1;
    return dataSource.query(
      "INSERT INTO Reservation (ConcertId, UserId, Quantity, Amount, Status, IdempotencyKey, CreatedAt) VALUES (?, ?, ?, 0, ?, ?, '2026-01-01T00:00:00.000Z')",
      [concertId, userId, quantity, status, `clave-${key}`],
    );
  };

  it('un concierto nuevo tiene disponibilidad = capacidad, con el artista unido', async () => {
    const { concert, available } = await newConcert('2099-01-01T00:00:00.000Z');

    expect(available).toBe(10);
    expect(concert.artist?.name).toBe('AC/DC');
    expect(concert.price).toBe(2.5);
  });

  it('descuenta las reservas PAID y COMPLETED, no las CANCELLED ni las PENDING (RF-2)', async () => {
    const { concert } = await newConcert('2099-02-01T00:00:00.000Z');
    await reserve(concert.id, 3, 'PAID');
    await reserve(concert.id, 2, 'COMPLETED');
    await reserve(concert.id, 4, 'CANCELLED');
    await reserve(concert.id, 1, 'PENDING');

    const found = await repository.findById(concert.id);

    expect(found?.available).toBe(10 - 3 - 2);
  });

  it('findById inexistente → null', async () => {
    await expect(repository.findById(999999)).resolves.toBeNull();
  });

  it('findPage ordena por fecha y pagina', async () => {
    const later = await newConcert('2099-12-31T00:00:00.000Z');
    const earlier = await newConcert('2098-01-01T00:00:00.000Z');

    const page = await repository.findPage(0, 100);
    const ids = page.map((item) => item.concert.id);

    expect(ids.indexOf(earlier.concert.id)).toBeLessThan(
      ids.indexOf(later.concert.id),
    );
    await expect(repository.findPage(0, 1)).resolves.toHaveLength(1);
  });

  it('el DTO de respuesta copia los campos y la disponibilidad', async () => {
    const created = await newConcert('2099-03-01T00:00:00.000Z', 7);

    expect(ConcertResponseDto.fromEntity(created)).toEqual({
      ConcertId: created.concert.id,
      ArtistId: 1,
      ArtistName: 'AC/DC',
      Title: 'Concierto 2099-03-01T00:00:00.000Z',
      StartsAt: '2099-03-01T00:00:00.000Z',
      Capacity: 7,
      Price: 2.5,
      Available: 7,
    });
  });
});
