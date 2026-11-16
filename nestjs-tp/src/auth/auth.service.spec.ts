import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity.js';
import { PasswordHasher } from '../users/password-hasher.js';
import { UsersRepository } from '../users/users.repository.js';
import {
  AuthService,
  INVALID_CREDENTIALS,
  INVALID_LOGIN,
} from './auth.service.js';

/** Secreto de prueba: no es real. */
const SECRET = 'secreto-de-prueba-unitaria-de-32-caracteres';
const EXPIRES_SECONDS = 30 * 60;

function jwtWith(secret: string): JwtService {
  return new JwtService({
    secret,
    signOptions: { algorithm: 'HS256', expiresIn: EXPIRES_SECONDS },
    verifyOptions: { algorithms: ['HS256'] },
  });
}

function user(overrides: Partial<User> = {}): User {
  return Object.assign(
    new User(),
    {
      id: 7,
      username: 'ana',
      email: 'ana@example.com',
      fullName: null,
      disabled: false,
      isAdmin: false,
      hashedPassword: '$2b$04$hash',
    },
    overrides,
  );
}

/** Base64url sin relleno, como en un JWT. */
function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('AuthService (spec 002)', () => {
  const users = {
    findByUsernameWithPassword: vi.fn(),
    findById: vi.fn(),
  };
  const hasher = {
    verify: vi.fn(),
    verifyAgainstReference: vi.fn(),
  };
  const jwt = jwtWith(SECRET);
  const service = new AuthService(
    users as unknown as UsersRepository,
    hasher as unknown as PasswordHasher,
    jwt,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    hasher.verifyAgainstReference.mockResolvedValue(false);
  });

  describe('login (RF-1, RF-2, RNF-4)', () => {
    it('credenciales correctas → credencial firmada que identifica al usuario y vence en 30 min', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(user());
      hasher.verify.mockResolvedValue(true);

      const token = await service.login('ana', 'correcta');
      const payload = await jwt.verifyAsync<{
        sub: string;
        iat: number;
        exp: number;
      }>(token);

      expect(payload.sub).toBe('7');
      expect(payload.exp - payload.iat).toBe(EXPIRES_SECONDS);
      expect(hasher.verify).toHaveBeenCalledWith('correcta', '$2b$04$hash');
    });

    it('la credencial no lleva la contraseña, el hash ni el rol (caso 9)', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(user());
      hasher.verify.mockResolvedValue(true);

      const token = await service.login('ana', 'correcta');
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString(),
      ) as object;

      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub']);
    });

    it('contraseña incorrecta → 401 genérico (caso 1)', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(user());
      hasher.verify.mockResolvedValue(false);

      await expect(service.login('ana', 'mala')).rejects.toThrow(
        new UnauthorizedException(INVALID_LOGIN),
      );
    });

    it('usuario inexistente → el MISMO 401, y verifica igual contra la referencia (caso 2, RNF-4)', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(null);

      await expect(service.login('nadie', 'algo')).rejects.toThrow(
        new UnauthorizedException(INVALID_LOGIN),
      );
      expect(hasher.verifyAgainstReference).toHaveBeenCalledWith('algo');
    });

    it('usuario deshabilitado → el MISMO 401, sin aceptar la contraseña (caso 11, RNF-4)', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(
        user({ disabled: true }),
      );
      hasher.verify.mockResolvedValue(true);

      await expect(service.login('ana', 'correcta')).rejects.toThrow(
        new UnauthorizedException(INVALID_LOGIN),
      );
      expect(hasher.verifyAgainstReference).toHaveBeenCalledWith('correcta');
    });

    it('pasa el username al repository, que lo busca sin mayúsculas ni espacios (caso 21)', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(null);

      await service.login(' ANA ', 'x').catch(() => undefined);

      expect(users.findByUsernameWithPassword).toHaveBeenCalledWith(' ANA ');
    });
  });

  describe('authenticate (RF-3, RF-4)', () => {
    async function validToken(id = 7): Promise<string> {
      return jwt.signAsync({ sub: String(id) });
    }

    it('credencial válida de un usuario habilitado → el usuario de la base', async () => {
      users.findById.mockResolvedValue(user());

      await expect(
        service.authenticate(`Bearer ${await validToken()}`),
      ).resolves.toEqual(user());
      expect(users.findById).toHaveBeenCalledWith(7);
    });

    it('el esquema "bearer" no distingue mayúsculas (caso 12)', async () => {
      users.findById.mockResolvedValue(user());

      await expect(
        service.authenticate(`bearer ${await validToken()}`),
      ).resolves.toEqual(user());
    });

    it.each([
      ['sin header (caso 6)', undefined],
      ['header vacío (caso 12)', ''],
      ['solo "Bearer" (caso 12)', 'Bearer '],
      ['otro esquema (caso 12)', 'Basic YWRtaW46YWRtaW4xMjM='],
      ['basura en lugar de credencial', 'Bearer no-es-un-token'],
    ])('%s → 401 Could not validate credentials', async (_case, header) => {
      await expect(service.authenticate(header)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
    });

    it('credencial vencida → 401 (caso 4)', async () => {
      const expired = await jwtWith(SECRET).signAsync(
        { sub: '7' },
        { expiresIn: -60 },
      );

      await expect(service.authenticate(`Bearer ${expired}`)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
    });

    it('credencial editada a mano (otro sub con la firma vieja) → 401 (caso 5)', async () => {
      const [header, , signature] = (await validToken(7)).split('.');
      const forged = [header, base64url({ sub: '1' }), signature].join('.');

      await expect(service.authenticate(`Bearer ${forged}`)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('credencial firmada con otro secreto → 401 (caso 5)', async () => {
      const foreign = await jwtWith(
        'otro-secreto-de-32-caracteres-xxxxxxx',
      ).signAsync({ sub: '7' });

      await expect(service.authenticate(`Bearer ${foreign}`)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
    });

    it('credencial "sin firma" (alg none) → 401 (caso 5)', async () => {
      const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: '7' })}.`;

      await expect(service.authenticate(`Bearer ${unsigned}`)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
    });

    it('credencial válida de un usuario que ya no existe → 401', async () => {
      users.findById.mockResolvedValue(null);

      await expect(
        service.authenticate(`Bearer ${await validToken(999)}`),
      ).rejects.toThrow(new UnauthorizedException(INVALID_CREDENTIALS));
    });

    it('credencial con un sub que no es un id → 401', async () => {
      const weird = await jwt.signAsync({ sub: 'admin' });

      await expect(service.authenticate(`Bearer ${weird}`)).rejects.toThrow(
        new UnauthorizedException(INVALID_CREDENTIALS),
      );
      expect(users.findById).not.toHaveBeenCalled();
    });

    it('credencial válida de un usuario deshabilitado → 401 Inactive user (caso 3)', async () => {
      users.findById.mockResolvedValue(user({ disabled: true }));

      await expect(
        service.authenticate(`Bearer ${await validToken()}`),
      ).rejects.toThrow(new UnauthorizedException('Inactive user'));
    });
  });
});
