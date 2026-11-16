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

const LOGIN = '/api/v1/auth/token';
const INVALID_LOGIN = { detail: 'Incorrect username or password' };

interface TokenBody {
  access_token: string;
  token_type: string;
}

describe('Login (e2e) — spec 002 RF-1, RF-2', () => {
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
  const login = (body: string | object) =>
    http().post(LOGIN).set('Content-Type', 'application/json').send(body);

  describe('credenciales correctas (RF-1)', () => {
    it('responde 200 con access_token y token_type "bearer", y nada más (caso 9)', async () => {
      const response = await login({
        username: 'test_admin',
        password: TEST_PASSWORDS.admin,
      }).expect(200);
      const body = response.body as TokenBody;

      expect(Object.keys(body).sort()).toEqual(['access_token', 'token_type']);
      expect(body.token_type).toBe('bearer');
      expect(JSON.stringify(body)).not.toContain(TEST_PASSWORDS.admin);
    });

    it('la credencial no lleva datos del usuario: solo sub, iat y exp (caso 9)', async () => {
      const response = await login({
        username: 'test_admin',
        password: TEST_PASSWORDS.admin,
      }).expect(200);
      const [, payload] = (response.body as TokenBody).access_token.split('.');

      expect(
        Object.keys(
          JSON.parse(Buffer.from(payload, 'base64url').toString()) as object,
        ).sort(),
      ).toEqual(['exp', 'iat', 'sub']);
    });

    it('la credencial obtenida sirve: un admin puede escribir en el catálogo', async () => {
      const response = await login({
        username: 'test_admin',
        password: TEST_PASSWORDS.admin,
      }).expect(200);

      await http()
        .patch('/api/v1/genres/3')
        .set('Authorization', bearer((response.body as TokenBody).access_token))
        .send({})
        .expect(200);
    });

    it('la credencial de un viewer no alcanza para escribir → 403', async () => {
      const response = await login({
        username: 'test_viewer',
        password: TEST_PASSWORDS.viewer,
      }).expect(200);

      await http()
        .post('/api/v1/genres')
        .set('Authorization', bearer((response.body as TokenBody).access_token))
        .send({ Name: 'Del viewer' })
        .expect(403);
    });

    it('el username no distingue mayúsculas ni espacios en los extremos (caso 21)', async () => {
      await login({
        username: '  TEST_Admin ',
        password: TEST_PASSWORDS.admin,
      }).expect(200);
    });

    it('el login es público: una credencial basura en el header se ignora', async () => {
      await login({ username: 'test_admin', password: TEST_PASSWORDS.admin })
        .set('Authorization', 'Bearer basura')
        .expect(200);
    });

    it('dos logins simultáneos del mismo usuario → ambos 200 con credenciales que sirven (caso 10)', async () => {
      const [first, second] = await Promise.all([
        login({ username: 'test_admin', password: TEST_PASSWORDS.admin }),
        login({ username: 'test_admin', password: TEST_PASSWORDS.admin }),
      ]);

      expect([first.status, second.status]).toEqual([200, 200]);
      for (const response of [first, second]) {
        await http()
          .patch('/api/v1/genres/3')
          .set(
            'Authorization',
            bearer((response.body as TokenBody).access_token),
          )
          .send({})
          .expect(200);
      }
    });
  });

  describe('credenciales incorrectas: siempre el mismo 401 (RF-2)', () => {
    it('contraseña incorrecta → 401 genérico con WWW-Authenticate (caso 1)', async () => {
      const response = await login({
        username: 'test_admin',
        password: 'no-es-la-contraseña',
      }).expect(401, INVALID_LOGIN);

      expect(response.headers['www-authenticate']).toBe('Bearer');
    });

    it('la contraseña sí distingue mayúsculas', async () => {
      await login({
        username: 'test_admin',
        password: TEST_PASSWORDS.admin.toUpperCase(),
      }).expect(401, INVALID_LOGIN);
    });

    it('usuario inexistente → exactamente la misma respuesta (caso 2)', async () => {
      await login({ username: 'no_existe', password: 'lo-que-sea' }).expect(
        401,
        INVALID_LOGIN,
      );
    });

    it('usuario deshabilitado, aun con su contraseña correcta → la misma respuesta (caso 11)', async () => {
      await login({
        username: users.disabled.username,
        password: TEST_PASSWORDS.disabled,
      }).expect(401, INVALID_LOGIN);
    });

    it('textos vacíos son credenciales incorrectas → 401', async () => {
      await login({ username: '', password: '' }).expect(401, INVALID_LOGIN);
    });
  });

  describe('cuerpo inválido → 400 (RF-2)', () => {
    it('JSON malformado → 400: el login es público, no hay credencial que mirar antes (caso 20)', async () => {
      const response = await login('{"username": ').expect(400);

      expect(Object.keys(response.body as object)).toEqual(['detail']);
    });

    it.each([
      [{ username: 'test_admin' }, /password/],
      [{ password: 'x' }, /username/],
      [{ username: 42, password: 'x' }, /username/],
      [{ username: 'test_admin', password: ['x'] }, /password/],
      [{ username: 'a', password: 'b', is_admin: true }, /is_admin/],
    ])('%j → 400 que nombra el campo', async (body, field) => {
      const response = await login(body).expect(400);

      expect((response.body as { detail: string }).detail).toMatch(field);
    });
  });
});
