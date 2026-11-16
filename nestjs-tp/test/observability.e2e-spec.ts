import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import {
  JsonLogger,
  type LogLevelName,
} from '../src/observability/json-logger.js';
import { currentRequestId } from '../src/observability/request-context.js';
import { bearer, seedTestUsers, TEST_PASSWORDS } from './helpers/auth.js';
import {
  ControllablePaymentGateway,
  FakeClock,
  withDoubles,
} from './helpers/reservations-doubles.js';
import { createTestApp } from './helpers/test-app.js';

type LogRecord = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** App completa con el logger JSON de producción escribiendo en un arreglo. */
async function createLoggedApp(level: LogLevelName) {
  const lines: string[] = [];
  const gateway = new ControllablePaymentGateway();
  const logger = new JsonLogger({
    level,
    write: (line) => lines.push(line),
    requestId: currentRequestId,
  });
  const app = await createTestApp(withDoubles(gateway, new FakeClock()), {
    logger,
  });
  const records = (): LogRecord[] =>
    lines.map((line): LogRecord => {
      const parsed: unknown = JSON.parse(line);
      return typeof parsed === 'object' && parsed !== null ? { ...parsed } : {};
    });
  return { app, lines, records, gateway };
}

/** Logs estructurados y requestId (spec 007 RF-11–RF-14; casos 4, 7, 8, 14, 15). */
describe('Observabilidad (e2e, spec 007)', () => {
  let app: INestApplication<App>;
  let lines: string[];
  let records: () => LogRecord[];
  let gateway: ControllablePaymentGateway;
  let adminToken = '';
  let viewerToken = '';

  beforeAll(async () => {
    ({ app, lines, records, gateway } = await createLoggedApp('debug'));
    ({ adminToken, viewerToken } = await seedTestUsers(app));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lines.length = 0;
  });

  const http = () => request(app.getHttpServer());
  const forRequest = (id: string) =>
    records().filter((record) => record.requestId === id);

  it('caso 7: un X-Request-Id válido se respeta, vuelve en la respuesta y queda en el log', async () => {
    const response = await http()
      .get('/api/v1/genres')
      .set('X-Request-Id', 'pedido-e2e-7')
      .expect(200);
    expect(response.headers['x-request-id']).toBe('pedido-e2e-7');
    expect(forRequest('pedido-e2e-7')).toEqual([
      expect.objectContaining({
        level: 'log',
        context: 'HTTP',
        method: 'GET',
        path: '/api/v1/genres',
        statusCode: 200,
        durationMs: expect.any(Number),
        timestamp: expect.stringMatching(/Z$/),
      }),
    ]);
  });

  it.each(['x'.repeat(65), 'con espacio', 'comilla"x', '<script>'])(
    'caso 8: X-Request-Id inseguro (%j) → se genera uno nuevo',
    async (header) => {
      const response = await http()
        .get('/api/v1/genres')
        .set('X-Request-Id', header)
        .expect(200);
      expect(response.headers['x-request-id']).toMatch(UUID);
      expect(lines.join('')).not.toContain(header);
    },
  );

  it('sin X-Request-Id → UUID nuevo en cada pedido', async () => {
    const first = await http().get('/api/v1/genres').expect(200);
    const second = await http().get('/api/v1/genres').expect(200);
    expect(first.headers['x-request-id']).toMatch(UUID);
    expect(second.headers['x-request-id']).not.toBe(
      first.headers['x-request-id'],
    );
  });

  it('caso 14: la ruta del log no tiene la query string', async () => {
    await http()
      .get('/api/v1/tracks/search?q=texto-buscado-14&limit=5')
      .set('X-Request-Id', 'pedido-e2e-14')
      .expect(200);
    expect(forRequest('pedido-e2e-14')[0]).toMatchObject({
      path: '/api/v1/tracks/search',
    });
    expect(lines.join('')).not.toContain('texto-buscado-14');
  });

  it('un 4xx se registra como warn', async () => {
    await http()
      .get('/api/v1/genres/999999')
      .set('X-Request-Id', 'pedido-e2e-404')
      .expect(404);
    expect(forRequest('pedido-e2e-404')[0]).toMatchObject({
      level: 'warn',
      statusCode: 404,
    });
  });

  it('caso 4: un 500 real deja el error con el requestId y sin la credencial', async () => {
    const concert = await http()
      .post('/api/v1/concerts')
      .set('Authorization', bearer(adminToken))
      .send({
        ArtistId: 1,
        Title: 'Concierto observabilidad',
        StartsAt: '2099-06-01T21:00:00Z',
        Capacity: 10,
        Price: 5,
      })
      .expect(201);
    gateway.mode = 'error';
    lines.length = 0;

    await http()
      .post('/api/v1/reservations')
      .set('Authorization', bearer(viewerToken))
      .set('Idempotency-Key', 'clave-observabilidad-1')
      .set('X-Request-Id', 'pedido-e2e-500')
      .send({
        ConcertId: (concert.body as { ConcertId: number }).ConcertId,
        Quantity: 1,
      })
      .expect(500);

    const logged = forRequest('pedido-e2e-500');
    // El detalle técnico (filtro de errores) y la línea del pedido, ambos con el id.
    expect(logged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: 'error',
          message: expect.stringContaining(
            'Falla inesperada del medio de pago',
          ),
        }),
        expect.objectContaining({ level: 'error', statusCode: 500 }),
      ]),
    );
    const all = lines.join('');
    expect(all).not.toContain(viewerToken);
    expect(all).not.toContain(adminToken);
  });

  it('caso 4: la contraseña de un login nunca llega al log', async () => {
    await http()
      .post('/api/v1/auth/token')
      .send({ username: 'test_viewer', password: 'mal-password-e2e' })
      .expect(401);
    await http()
      .post('/api/v1/auth/token')
      .send({ username: 'test_viewer', password: TEST_PASSWORDS.viewer })
      .expect(200);
    const all = lines.join('');
    expect(all).not.toContain('mal-password-e2e');
    expect(all).not.toContain(TEST_PASSWORDS.viewer);
  });

  it('todas las líneas son JSON con timestamp, level y message', async () => {
    await http().get('/api/v1/artists/1').expect(200);
    await http().get('/api/v1/artists/999999').expect(404);
    expect(lines.length).toBeGreaterThan(0);
    for (const record of records()) {
      expect(record).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          level: expect.any(String),
          message: expect.any(String),
        }),
      );
    }
  });
});

describe('Observabilidad con LOG_LEVEL=warn (e2e, caso 15)', () => {
  it('un 200 no deja línea; un 404 sí', async () => {
    const { app, records } = await createLoggedApp('warn');
    try {
      await request(app.getHttpServer())
        .get('/api/v1/genres')
        .set('X-Request-Id', 'nivel-200')
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/v1/genres/999999')
        .set('X-Request-Id', 'nivel-404')
        .expect(404);
      const ids = records().map((record) => record.requestId);
      expect(ids).not.toContain('nivel-200');
      expect(ids).toContain('nivel-404');
    } finally {
      await app.close();
    }
  });
});
