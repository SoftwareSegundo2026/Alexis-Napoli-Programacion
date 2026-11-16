import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AuthService } from '../../src/auth/auth.service.js';
import { User } from '../../src/users/entities/user.entity.js';
import { PasswordHasher } from '../../src/users/password-hasher.js';
import { UsersRepository } from '../../src/users/users.repository.js';
import { TEST_JWT_SECRET } from './test-env.js';

/**
 * Contraseñas de los usuarios de prueba. NO son contraseñas reales (spec 002
 * RNF-3): existen solo en la copia temporal de la base de cada archivo e2e.
 */
export const TEST_PASSWORDS = {
  admin: 'admin-de-prueba-123',
  viewer: 'viewer-de-prueba-123',
  disabled: 'disabled-de-prueba-123',
} as const;

export interface TestUsers {
  admin: User;
  viewer: User;
  disabled: User;
  /** Credenciales vigentes, listas para `Authorization: Bearer ...`. */
  adminToken: string;
  viewerToken: string;
  /** Credencial emitida ANTES de deshabilitar al usuario (caso 3). */
  disabledToken: string;
}

/**
 * Siembra `test_admin`, `test_viewer` y `test_disabled` en la base temporal del
 * archivo e2e y les emite credenciales con el mismo servicio que usa el login.
 * (El login en sí se prueba en `auth.e2e-spec.ts`.)
 */
export async function seedTestUsers(
  app: INestApplication<App>,
): Promise<TestUsers> {
  const users = app.get(UsersRepository);
  const hasher = app.get(PasswordHasher);
  const auth = app.get(AuthService);

  const create = async (
    name: keyof typeof TEST_PASSWORDS,
    isAdmin: boolean,
  ): Promise<User> =>
    users.create({
      username: `test_${name}`,
      email: `test_${name}@example.com`,
      fullName: `Usuario de prueba ${name}`,
      isAdmin,
      hashedPassword: await hasher.hash(TEST_PASSWORDS[name]),
    });

  const admin = await create('admin', true);
  const viewer = await create('viewer', false);
  const disabled = await create('disabled', false);
  const disabledToken = await auth.issueToken(disabled);
  await app
    .get(DataSource)
    .getRepository(User)
    .update({ id: disabled.id }, { disabled: true });
  disabled.disabled = true;

  return {
    admin,
    viewer,
    disabled,
    adminToken: await auth.issueToken(admin),
    viewerToken: await auth.issueToken(viewer),
    disabledToken,
  };
}

/** Header `Authorization` con esquema Bearer. */
export function bearer(token: string): string {
  return `Bearer ${token}`;
}

/** Credencial vencida hace un minuto, firmada con el secreto de los tests (caso 4). */
export function expiredTokenFor(user: User): Promise<string> {
  return new JwtService({ secret: TEST_JWT_SECRET }).signAsync(
    { sub: String(user.id) },
    { algorithm: 'HS256', expiresIn: -60 },
  );
}

/** Credencial con un carácter de la firma cambiado (caso 5). */
export function tamper(token: string): string {
  const last = token.at(-2) === 'A' ? 'B' : 'A';
  return `${token.slice(0, -2)}${last}${token.at(-1) ?? ''}`;
}
