import { ArgumentMetadata } from '@nestjs/common';
import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { User } from '../entities/user.entity.js';
import { CreateUserDto } from './create-user.dto.js';
import { UserResponseDto } from './user-response.dto.js';

function validateBody(
  metatype: ArgumentMetadata['metatype'],
  body: unknown,
): Promise<unknown> {
  return new RequestValidationPipe().transform(body, {
    type: 'body',
    metatype,
    data: undefined,
  });
}

const valid = {
  username: 'nuevo.usuario_1',
  email: 'nuevo@example.com',
  password: 'ocho-car',
};

describe('CreateUserDto (spec 002 RF-10, tabla de reglas)', () => {
  it('acepta un alta válida y recorta username, email y nombre', async () => {
    await expect(
      validateBody(CreateUserDto, {
        username: '  nuevo  ',
        email: ' nuevo@example.com ',
        password: 'ocho-car',
        full_name: '  Ana  ',
        is_admin: true,
      }),
    ).resolves.toEqual({
      username: 'nuevo',
      email: 'nuevo@example.com',
      password: 'ocho-car',
      full_name: 'Ana',
      is_admin: true,
    });
  });

  it('la contraseña NO se recorta: se compara exacta en el login (RF-1)', async () => {
    await expect(
      validateBody(CreateUserDto, { ...valid, password: ' con espacios ' }),
    ).resolves.toEqual(expect.objectContaining({ password: ' con espacios ' }));
  });

  it('acepta contraseñas de 8 y de 72 caracteres', async () => {
    await expect(
      validateBody(CreateUserDto, { ...valid, password: 'x'.repeat(8) }),
    ).resolves.toBeInstanceOf(CreateUserDto);
    await expect(
      validateBody(CreateUserDto, { ...valid, password: 'x'.repeat(72) }),
    ).resolves.toBeInstanceOf(CreateUserDto);
  });

  it.each([
    ['sin username', { ...valid, username: undefined }, /username/],
    ['username corto', { ...valid, username: 'ab' }, /username/],
    ['username largo', { ...valid, username: 'x'.repeat(81) }, /username/],
    ['username con espacios', { ...valid, username: 'ana perez' }, /username/],
    ['username con @', { ...valid, username: 'ana@x' }, /username/],
    ['sin email', { ...valid, email: undefined }, /email/],
    ['email inválido', { ...valid, email: 'no-es-email' }, /email/],
    ['email largo', { ...valid, email: `${'x'.repeat(115)}@a.com` }, /email/],
    ['sin password', { ...valid, password: undefined }, /password/],
    ['password de 7', { ...valid, password: 'x'.repeat(7) }, /password/],
    [
      'password de 73 (caso 19)',
      { ...valid, password: 'x'.repeat(73) },
      /password/,
    ],
    ['full_name largo', { ...valid, full_name: 'x'.repeat(121) }, /full_name/],
    ['is_admin no booleano', { ...valid, is_admin: 'si' }, /is_admin/],
    [
      'hashed_password en el cuerpo (caso 17)',
      { ...valid, hashed_password: 'x' },
      /hashed_password/,
    ],
    ['disabled en el alta', { ...valid, disabled: true }, /disabled/],
  ])('%s → 400 que nombra el campo', async (_case, body, field) => {
    await expect(validateBody(CreateUserDto, body)).rejects.toThrow(field);
  });
});

describe('UserResponseDto (spec 002 RNF-1)', () => {
  it('expone los campos del servicio original y nunca el hash', () => {
    const entity = Object.assign(new User(), {
      id: 5,
      username: 'ana',
      email: 'ana@example.com',
      fullName: null,
      disabled: false,
      isAdmin: true,
      hashedPassword: '$2b$12$secreto',
    });

    const dto = UserResponseDto.fromEntity(entity);

    expect(dto).toEqual({
      user_id: 5,
      username: 'ana',
      email: 'ana@example.com',
      full_name: null,
      disabled: false,
      is_admin: true,
    });
    expect(JSON.stringify(dto)).not.toContain('$2b$');
  });
});
