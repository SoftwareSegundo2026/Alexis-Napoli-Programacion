import { ConflictException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto.js';
import { User } from './entities/user.entity.js';
import { PasswordHasher } from './password-hasher.js';
import {
  DuplicateUserError,
  UsersRepository,
  type NewUser,
} from './users.repository.js';
import { UsersService } from './users.service.js';

function dto(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
  return Object.assign(new CreateUserDto(), {
    username: 'nuevo',
    email: 'nuevo@example.com',
    password: 'una-contraseña',
    ...overrides,
  });
}

function storedFrom(data: NewUser, id: number): User {
  return Object.assign(new User(), {
    id,
    username: data.username,
    email: data.email,
    fullName: data.fullName,
    isAdmin: data.isAdmin,
    disabled: false,
  });
}

describe('UsersService (spec 002 RF-8, RF-9)', () => {
  const repository = {
    findPage: vi.fn(),
    usernameExists: vi.fn(),
    emailExists: vi.fn(),
    create: vi.fn(),
  };
  const hasher = { hash: vi.fn() };
  const service = new UsersService(
    repository as unknown as UsersRepository,
    hasher as unknown as PasswordHasher,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    repository.usernameExists.mockResolvedValue(false);
    repository.emailExists.mockResolvedValue(false);
    hasher.hash.mockResolvedValue('$2b$04$hash-de-prueba');
    repository.create.mockImplementation((data: NewUser) =>
      Promise.resolve(storedFrom(data, 99)),
    );
  });

  it('el listado pide la página al repository (RF-8)', async () => {
    repository.findPage.mockResolvedValue([]);

    await service.findAll({ skip: 10, limit: 5 });

    expect(repository.findPage).toHaveBeenCalledWith(10, 5);
  });

  it('el alta guarda SOLO el hash de la contraseña, nunca la contraseña (RF-9)', async () => {
    await service.create(dto({ full_name: 'Ana Pérez', is_admin: true }));

    expect(hasher.hash).toHaveBeenCalledWith('una-contraseña');
    expect(repository.create).toHaveBeenCalledWith({
      username: 'nuevo',
      email: 'nuevo@example.com',
      fullName: 'Ana Pérez',
      isAdmin: true,
      hashedPassword: '$2b$04$hash-de-prueba',
    });
    expect(JSON.stringify(repository.create.mock.calls)).not.toContain(
      'una-contraseña',
    );
  });

  it('por defecto el usuario nuevo es viewer y sin nombre completo', async () => {
    await service.create(dto());

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ isAdmin: false, fullName: null }),
    );
  });

  it('username ocupado → 409 y no guarda (caso 8)', async () => {
    repository.usernameExists.mockResolvedValue(true);

    await expect(service.create(dto())).rejects.toThrow(
      new ConflictException('Username already registered'),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('email ocupado → 409 y no guarda (caso 8)', async () => {
    repository.emailExists.mockResolvedValue(true);

    await expect(service.create(dto())).rejects.toThrow(
      new ConflictException('Email already registered'),
    );
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('si la base igual rechaza el duplicado (red de seguridad) → 409, no 500', async () => {
    repository.create.mockRejectedValue(new DuplicateUserError('email'));

    await expect(service.create(dto())).rejects.toThrow(
      new ConflictException('Email already registered'),
    );
  });

  it('dos altas simultáneas con el mismo username → una se crea y la otra 409 (caso 23)', async () => {
    // Repository "con estado": el chequeo de duplicado y el guardado tardan.
    const taken = new Set<string>();
    repository.usernameExists.mockImplementation(async (name: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return taken.has(name);
    });
    repository.create.mockImplementation(async (data: NewUser) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      taken.add(data.username);
      return storedFrom(data, 100);
    });

    const results = await Promise.allSettled([
      service.create(dto()),
      service.create(dto()),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(repository.create).toHaveBeenCalledTimes(1);
  });

  it('un alta fallida no traba las siguientes', async () => {
    repository.usernameExists.mockResolvedValueOnce(true);

    await expect(service.create(dto())).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(
      service.create(dto({ username: 'otro' })),
    ).resolves.toBeDefined();
  });
});
