import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DatabaseProbe, HEALTH_QUERY } from './database-probe.js';
import { HealthController } from './health.controller.js';

/** Chequeo de salud (spec 007 RF-5). */
describe('DatabaseProbe', () => {
  async function createProbe(query: (sql: string) => Promise<unknown>) {
    const moduleRef = await Test.createTestingModule({
      providers: [DatabaseProbe, { provide: DataSource, useValue: { query } }],
    }).compile();
    return moduleRef.get(DatabaseProbe);
  }

  it('consulta el catálogo del archivo (no SELECT 1) y responde arriba', async () => {
    const executed: string[] = [];
    const probe = await createProbe((sql) => {
      executed.push(sql);
      return Promise.resolve([{ total: 12 }]);
    });

    await expect(probe.isUp()).resolves.toBe(true);
    expect(executed).toEqual([HEALTH_QUERY]);
    expect(HEALTH_QUERY).toContain('sqlite_master');
  });

  it('si la consulta falla, responde caída (sin lanzar)', async () => {
    const probe = await createProbe(() =>
      Promise.reject(new Error('file is not a database')),
    );
    await expect(probe.isUp()).resolves.toBe(false);
  });
});

describe('HealthController', () => {
  async function createController(up: boolean) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: DatabaseProbe,
          useValue: { isUp: () => Promise.resolve(up) },
        },
      ],
    }).compile();
    return moduleRef.get(HealthController);
  }

  function createResponse() {
    const statuses: number[] = [];
    return {
      statuses,
      response: {
        status: (code: number) => {
          statuses.push(code);
        },
      },
    };
  }

  it('base arriba → cuerpo ok, sin tocar el código (200)', async () => {
    const controller = await createController(true);
    const { response, statuses } = createResponse();
    await expect(controller.check(response)).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(statuses).toEqual([]);
  });

  it('base caída → 503 con detail', async () => {
    const controller = await createController(false);
    const { response, statuses } = createResponse();
    await expect(controller.check(response)).resolves.toEqual({
      status: 'error',
      database: 'down',
      detail: 'Database unavailable',
    });
    expect(statuses).toEqual([503]);
  });
});
