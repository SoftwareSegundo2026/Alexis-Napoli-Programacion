import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  bearer,
  seedTestUsers,
  TEST_PASSWORDS,
  type TestUsers,
} from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

const USERS = '/api/v1/users';
const USER_FIELDS = [
  'disabled',
  'email',
  'full_name',
  'is_admin',
  'user_id',
  'username',
];

interface UserBody {
  user_id: number;
  username: string;
  email: string;
  full_name: string | null;
  disabled: boolean;
  is_admin: boolean;
}

describe('Usuarios (e2e) — spec 002 RF-7 a RF-10', () => {
  let app: INestApplication<App>;
  let users: TestUsers;

  beforeAll(async () => {
    app = await createTestApp();
    users = await seedTestUsers(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const asAdmin = (test: request.Test) =>
    test.set('Authorization', bearer(users.adminToken));
  const asViewer = (test: request.Test) =>
    test.set('Authorization', bearer(users.viewerToken));

  function expectNoSecrets(body: unknown): void {
    const json = JSON.stringify(body);
    expect(json).not.toContain('$2b$');
    expect(json).not.toMatch(/password/i);
  }

  describe('GET /users/me (RF-7)', () => {
    it('un viewer ve su perfil con el rol vigente y sin datos internos (caso 9)', async () => {
      const response = await asViewer(http().get(`${USERS}/me`)).expect(200);
      const me = response.body as UserBody;

      expect(Object.keys(me).sort()).toEqual(USER_FIELDS);
      expect(me).toMatchObject({
        user_id: users.viewer.id,
        username: 'test_viewer',
        is_admin: false,
        disabled: false,
      });
      expectNoSecrets(me);
    });

    it('un admin ve is_admin: true', async () => {
      const response = await asAdmin(http().get(`${USERS}/me`)).expect(200);

      expect((response.body as UserBody).is_admin).toBe(true);
    });

    it('sin credencial → 401; con la de un deshabilitado → 401 Inactive user (caso 3)', async () => {
      await http().get(`${USERS}/me`).expect(401);
      await http()
        .get(`${USERS}/me`)
        .set('Authorization', bearer(users.disabledToken))
        .expect(401, { detail: 'Inactive user' });
    });
  });

  describe('GET /users (RF-8)', () => {
    it('un admin lista los usuarios ordenados por user_id, sin datos internos', async () => {
      const response = await asAdmin(http().get(USERS)).expect(200);
      const list = response.body as UserBody[];
      const ids = list.map((user) => user.user_id);

      expect(ids).toEqual([...ids].sort((a, b) => a - b));
      expect(list.map((user) => user.username)).toContain('test_viewer');
      for (const user of list) {
        expect(Object.keys(user).sort()).toEqual(USER_FIELDS);
      }
      expectNoSecrets(list);
    });

    it('respeta skip y limit, con las mismas validaciones que el catálogo', async () => {
      const response = await asAdmin(
        http().get(USERS).query({ skip: 1, limit: 2 }),
      ).expect(200);

      expect(response.body as UserBody[]).toHaveLength(2);
      await asAdmin(http().get(USERS).query({ limit: 101 })).expect(400);
      await asAdmin(http().get(USERS).query({ skip: -1 })).expect(400);
    });

    it('un viewer → 403; sin credencial → 401', async () => {
      await asViewer(http().get(USERS)).expect(403, {
        detail: 'Admin privileges required',
      });
      await http().get(USERS).expect(401);
    });
  });

  describe('POST /users (RF-9, RF-10)', () => {
    it('un admin da de alta un viewer: 201, sin la contraseña, y el usuario puede loguearse', async () => {
      const response = await asAdmin(http().post(USERS))
        .send({
          username: '  nuevo_viewer ',
          email: 'nuevo_viewer@example.com',
          password: 'clave-nueva-123',
          full_name: 'Nuevo Viewer',
        })
        .expect(201);
      const created = response.body as UserBody;

      expect(Object.keys(created).sort()).toEqual(USER_FIELDS);
      expect(created).toMatchObject({
        username: 'nuevo_viewer',
        full_name: 'Nuevo Viewer',
        disabled: false,
        is_admin: false,
      });
      expectNoSecrets(created);

      const login = await http()
        .post('/api/v1/auth/token')
        .send({ username: 'nuevo_viewer', password: 'clave-nueva-123' })
        .expect(200);
      const token = (login.body as { access_token: string }).access_token;
      await http()
        .post('/api/v1/genres')
        .set('Authorization', bearer(token))
        .send({ Name: 'Del nuevo viewer' })
        .expect(403);
    });

    it('con is_admin: true el usuario nuevo es admin', async () => {
      const response = await asAdmin(http().post(USERS))
        .send({
          username: 'nuevo_admin',
          email: 'nuevo_admin@example.com',
          password: 'clave-nueva-123',
          is_admin: true,
        })
        .expect(201);

      expect((response.body as UserBody).is_admin).toBe(true);
    });

    it.each([
      [
        'el mismo username',
        { username: 'test_viewer', email: 'a1@example.com' },
      ],
      [
        'el username con mayúsculas y espacios',
        { username: ' TEST_Viewer ', email: 'a2@example.com' },
      ],
      [
        'el mismo email',
        { username: 'otro_1', email: 'test_viewer@example.com' },
      ],
      [
        'el email con mayúsculas',
        { username: 'otro_2', email: 'TEST_VIEWER@example.com' },
      ],
    ])('%s → 409 y no guarda (caso 8)', async (_case, fields) => {
      const before = await asAdmin(http().get(USERS)).expect(200);

      await asAdmin(http().post(USERS))
        .send({ ...fields, password: 'clave-nueva-123' })
        .expect(409);

      const after = await asAdmin(http().get(USERS)).expect(200);
      expect(after.body).toEqual(before.body);
    });

    it('dos altas simultáneas con el mismo username → una 201 y la otra 409 (caso 23)', async () => {
      const body = {
        username: 'simultaneo',
        email: 'simultaneo@example.com',
        password: 'clave-nueva-123',
      };

      const responses = await Promise.all([
        asAdmin(http().post(USERS)).send(body),
        asAdmin(http().post(USERS)).send({
          ...body,
          email: 'simultaneo2@example.com',
        }),
      ]);

      expect(
        responses.map((response) => response.status).sort((a, b) => a - b),
      ).toEqual([201, 409]);
      const list = await asAdmin(http().get(USERS)).expect(200);
      expect(
        (list.body as UserBody[]).filter(
          (user) => user.username === 'simultaneo',
        ),
      ).toHaveLength(1);
    });

    it.each([
      [
        'contraseña de 73 caracteres (caso 19)',
        { password: 'x'.repeat(73) },
        /password/,
      ],
      [
        'hashed_password en el cuerpo (caso 17)',
        { hashed_password: '$2b$12$x' },
        /hashed_password/,
      ],
      ['email inválido', { email: 'no-es-email' }, /email/],
      ['username con espacios', { username: 'con espacios' }, /username/],
    ])('%s → 400 que nombra el campo', async (_case, override, field) => {
      const response = await asAdmin(http().post(USERS))
        .send({
          username: 'valido_x',
          email: 'valido_x@example.com',
          password: 'clave-nueva-123',
          ...override,
        })
        .expect(400);

      expect((response.body as { detail: string }).detail).toMatch(field);
    });

    it('un viewer no puede dar de alta usuarios → 403; sin credencial → 401', async () => {
      const body = {
        username: 'intruso',
        email: 'intruso@example.com',
        password: 'clave-nueva-123',
        is_admin: true,
      };

      await asViewer(http().post(USERS)).send(body).expect(403);
      await http().post(USERS).send(body).expect(401);
      await http()
        .post('/api/v1/auth/token')
        .send({ username: 'intruso', password: 'clave-nueva-123' })
        .expect(401);
    });

    it('la contraseña del usuario de prueba sigue siendo la suya (no hay forma de leerla)', async () => {
      await http()
        .post('/api/v1/auth/token')
        .send({ username: 'test_viewer', password: TEST_PASSWORDS.viewer })
        .expect(200);
    });
  });
});
