import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers, type TestUsers } from './helpers/auth.js';
import { createTestApp } from './helpers/test-app.js';

const API = '/api/v1';
const PASSWORD = 'clave-de-prueba-123';

interface UserBody {
  user_id: number;
  username: string;
  disabled: boolean;
  is_admin: boolean;
}

describe('Modificación de usuarios (e2e) — spec 002 RF-11, RF-4', () => {
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

  /** Alta por la API + login: devuelve el usuario y su credencial vigente. */
  async function newUser(
    username: string,
    isAdmin = false,
  ): Promise<{ id: number; token: string }> {
    const created = await asAdmin(http().post(`${API}/users`))
      .send({
        username,
        email: `${username}@example.com`,
        password: PASSWORD,
        is_admin: isAdmin,
      })
      .expect(201);
    const login = await http()
      .post(`${API}/auth/token`)
      .send({ username, password: PASSWORD })
      .expect(200);
    return {
      id: (created.body as UserBody).user_id,
      token: (login.body as { access_token: string }).access_token,
    };
  }

  const patchUser = (id: number | string, body: object) =>
    asAdmin(http().patch(`${API}/users/${id}`)).send(body);

  describe('deshabilitar corta el acceso en el acto (RF-4, casos 3 y 11)', () => {
    it('la credencial VIGENTE de un usuario deshabilitado deja de servir, y vuelve al rehabilitarlo', async () => {
      const ana = await newUser('ana_deshabilitable');
      await http()
        .get(`${API}/users/me`)
        .set('Authorization', bearer(ana.token))
        .expect(200);

      const response = await patchUser(ana.id, { disabled: true }).expect(200);
      expect((response.body as UserBody).disabled).toBe(true);

      await http()
        .get(`${API}/users/me`)
        .set('Authorization', bearer(ana.token))
        .expect(401, { detail: 'Inactive user' });
      await http()
        .post(`${API}/auth/token`)
        .send({ username: 'ana_deshabilitable', password: PASSWORD })
        .expect(401, { detail: 'Incorrect username or password' });

      await patchUser(ana.id, { disabled: false }).expect(200);
      await http()
        .get(`${API}/users/me`)
        .set('Authorization', bearer(ana.token))
        .expect(200);
    });
  });

  describe('el rol vigente es el de la base, no el de la credencial (caso 13)', () => {
    it('ascender a admin habilita escribir con la MISMA credencial; quitarle el rol lo vuelve a impedir', async () => {
      const beto = await newUser('beto_rol');
      const write = () =>
        http()
          .patch(`${API}/genres/3`)
          .set('Authorization', bearer(beto.token))
          .send({});

      await write().expect(403);

      await patchUser(beto.id, { is_admin: true }).expect(200);
      await write().expect(200);

      await patchUser(beto.id, { is_admin: false }).expect(200);
      await write().expect(403, { detail: 'Admin privileges required' });
    });
  });

  describe('nadie cambia su propio rol ni se deshabilita (caso 14)', () => {
    it.each([
      ['quitarse el rol admin', { is_admin: false }],
      ['deshabilitarse', { disabled: true }],
    ])(
      'un admin que intenta %s → 403 y no cambia nada',
      async (_case, body) => {
        await patchUser(users.admin.id, body).expect(403, {
          detail: 'You cannot change your own role or status',
        });

        const me = await asAdmin(http().get(`${API}/users/me`)).expect(200);
        expect(me.body).toMatchObject({ is_admin: true, disabled: false });
      },
    );

    it('reenviar para sí mismo los valores que ya tiene → 200', async () => {
      await patchUser(users.admin.id, {
        is_admin: true,
        disabled: false,
      }).expect(200);
    });
  });

  describe('reglas generales (RF-11)', () => {
    it('{} → 200 y el usuario queda igual (caso 18)', async () => {
      const response = await patchUser(users.viewer.id, {}).expect(200);

      expect(response.body).toMatchObject({
        user_id: users.viewer.id,
        disabled: false,
        is_admin: false,
      });
    });

    it('la respuesta trae solo los campos del contrato, sin el hash', async () => {
      const response = await patchUser(users.viewer.id, {}).expect(200);

      expect(Object.keys(response.body as object).sort()).toEqual([
        'disabled',
        'email',
        'full_name',
        'is_admin',
        'user_id',
        'username',
      ]);
      expect(JSON.stringify(response.body)).not.toContain('$2b$');
    });

    it('id inexistente → 404 User not found; id no numérico → 400', async () => {
      await patchUser(99999, { disabled: true }).expect(404, {
        detail: 'User not found',
      });
      await patchUser('abc', { disabled: true }).expect(400);
    });

    it.each([
      [{ disabled: null }, /disabled/],
      [{ is_admin: 'si' }, /is_admin/],
      [{ password: 'cambiar-la-clave' }, /password/],
    ])('cuerpo inválido %j → 400 que nombra el campo', async (body, field) => {
      const response = await patchUser(users.viewer.id, body).expect(400);

      expect((response.body as { detail: string }).detail).toMatch(field);
    });

    it('un viewer → 403 (aunque el cuerpo sea inválido); sin credencial → 401', async () => {
      await http()
        .patch(`${API}/users/${users.admin.id}`)
        .set('Authorization', bearer(users.viewerToken))
        .send({ is_admin: 'no' })
        .expect(403);
      await http()
        .patch(`${API}/users/${users.viewer.id}`)
        .send({ is_admin: true })
        .expect(401);
    });
  });
});
