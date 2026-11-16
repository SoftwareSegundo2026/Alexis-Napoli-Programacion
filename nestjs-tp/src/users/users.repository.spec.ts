import { randomUUID } from 'node:crypto';
import { copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { TEMPLATE_DATABASE_PATH } from '../database/database.module.js';
import { User } from './entities/user.entity.js';
import { DuplicateUserError, UsersRepository } from './users.repository.js';

/**
 * Las consultas de este repository son SQL propio (comparación sin mayúsculas,
 * `select: false`, índice único): se prueban contra una copia REAL de la base,
 * porque un mock no comprobaría que el SQL sea correcto (spec 002 RNF-5).
 */
/**
 * El hash no se cargó: sin valor y ausente al serializar. (La clave existe con
 * `undefined` porque las clases ES2022+ definen todos sus campos al construirse.)
 */
function expectWithoutHash(user: User | null): void {
  expect(user).not.toBeNull();
  expect(user?.hashedPassword).toBeUndefined();
  expect(JSON.stringify(user)).not.toContain('$2b$');
}

describe('UsersRepository (contra una copia de la base)', () => {
  const databasePath = join(tmpdir(), `users-repo-${randomUUID()}.db`);
  let dataSource: DataSource;
  let repository: UsersRepository;

  const newUser = (username: string, email: string) => ({
    username,
    email,
    fullName: null,
    isAdmin: false,
    hashedPassword: '$2b$04$hashdeprueba',
  });

  beforeAll(async () => {
    copyFileSync(TEMPLATE_DATABASE_PATH, databasePath);
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: databasePath,
      entities: [User],
      synchronize: false,
    });
    await dataSource.initialize();
    repository = new UsersRepository(dataSource.getRepository(User));
  });

  afterAll(async () => {
    await dataSource.destroy();
    rmSync(databasePath, { force: true });
  });

  it('pagina en la base ordenando por user_id (RF-8)', async () => {
    const page = await repository.findPage(1, 2);

    expect(page.map((user) => user.id)).toEqual([6, 8]);
  });

  it('mapea las columnas: booleanos reales y SIN el hash (RNF-1)', async () => {
    const admin = await repository.findById(1);

    expect(admin).toMatchObject({
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      disabled: false,
      isAdmin: true,
    });
    expectWithoutHash(admin);
  });

  it('busca por username sin distinguir mayúsculas ni espacios (RF-1)', async () => {
    const found = await repository.findByUsername('  ADMIN ');

    expect(found?.id).toBe(1);
    expectWithoutHash(found);
  });

  it('solo el login carga el hash, y a propósito', async () => {
    const found = await repository.findByUsernameWithPassword('Admin');

    expect(found?.hashedPassword?.startsWith('$2b$12$')).toBe(true);
  });

  it('un username inexistente → null', async () => {
    await expect(repository.findByUsername('nadie')).resolves.toBeNull();
    await expect(
      repository.findByUsernameWithPassword('nadie'),
    ).resolves.toBeNull();
  });

  it('detecta username y email ocupados sin distinguir mayúsculas ni espacios (RF-9)', async () => {
    await expect(repository.usernameExists(' Reader ')).resolves.toBe(true);
    await expect(repository.usernameExists('libre')).resolves.toBe(false);
    await expect(repository.emailExists('READER@example.com ')).resolves.toBe(
      true,
    );
    await expect(repository.emailExists('libre@example.com')).resolves.toBe(
      false,
    );
  });

  it('crea un usuario y lo devuelve sin el hash', async () => {
    const created = await repository.create(
      newUser('nuevo_repo', 'nuevo_repo@example.com'),
    );

    expect(created).toMatchObject({
      username: 'nuevo_repo',
      disabled: false,
      isAdmin: false,
    });
    expect(created.id).toBeGreaterThan(12);
    expectWithoutHash(created);
  });

  it('si la base rechaza un username repetido, lo traduce a DuplicateUserError (red de seguridad)', async () => {
    const result = repository.create(newUser('admin', 'otro@example.com'));

    await expect(result).rejects.toBeInstanceOf(DuplicateUserError);
    await expect(result).rejects.toMatchObject({ field: 'username' });
  });

  it('lo mismo con un email repetido', async () => {
    await expect(
      repository.create(newUser('otro_nombre', 'admin@example.com')),
    ).rejects.toMatchObject({ field: 'email' });
  });
});
