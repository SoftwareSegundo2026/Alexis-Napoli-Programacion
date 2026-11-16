import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';
import { PasswordHasher } from './password-hasher.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

function user(id: number, overrides: Partial<User> = {}): User {
  return Object.assign(
    new User(),
    {
      id,
      username: `u${id}`,
      email: `u${id}@example.com`,
      fullName: null,
      disabled: false,
      isAdmin: false,
    },
    overrides,
  );
}

function changes(values: Partial<UpdateUserDto>): UpdateUserDto {
  return Object.assign(new UpdateUserDto(), values);
}

describe('UsersService.update (spec 002 RF-11)', () => {
  const repository = { findById: vi.fn(), update: vi.fn() };
  const service = new UsersService(
    repository as unknown as UsersRepository,
    {} as PasswordHasher,
  );
  const admin = user(1, { isAdmin: true });

  beforeEach(() => {
    vi.resetAllMocks();
    repository.update.mockImplementation((id: number, values: Partial<User>) =>
      Promise.resolve(user(id, values)),
    );
  });

  it('un admin deshabilita a otro usuario', async () => {
    repository.findById.mockResolvedValue(user(7));

    await expect(
      service.update(admin, 7, changes({ disabled: true })),
    ).resolves.toMatchObject({ id: 7, disabled: true });
    expect(repository.update).toHaveBeenCalledWith(7, { disabled: true });
  });

  it('un admin cambia el rol de otro usuario, y solo eso', async () => {
    repository.findById.mockResolvedValue(user(7));

    await service.update(admin, 7, changes({ is_admin: true }));

    expect(repository.update).toHaveBeenCalledWith(7, { isAdmin: true });
  });

  it('con {} no cambia nada y devuelve el usuario como está (caso 18)', async () => {
    repository.findById.mockResolvedValue(user(7));

    await expect(service.update(admin, 7, changes({}))).resolves.toEqual(
      user(7),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('id inexistente → 404 User not found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.update(admin, 999, changes({ disabled: true })),
    ).rejects.toThrow(new NotFoundException('User not found'));
  });

  it.each([
    ['quitarse el rol', { is_admin: false }],
    ['deshabilitarse', { disabled: true }],
    ['las dos cosas', { is_admin: false, disabled: true }],
  ])(
    'un admin NO puede %s → 403 y no cambia nada (caso 14)',
    async (_case, values) => {
      repository.findById.mockResolvedValue(admin);

      await expect(service.update(admin, 1, changes(values))).rejects.toThrow(
        new ForbiddenException('You cannot change your own role or status'),
      );
      expect(repository.update).not.toHaveBeenCalled();
    },
  );

  it('reenviar para sí mismo el valor que ya tiene no es un cambio → OK (caso 14)', async () => {
    repository.findById.mockResolvedValue(admin);

    await expect(
      service.update(admin, 1, changes({ is_admin: true, disabled: false })),
    ).resolves.toEqual(admin);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
