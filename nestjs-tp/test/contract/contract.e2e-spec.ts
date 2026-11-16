import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from '../helpers/auth.js';
import {
  ControllablePaymentGateway,
  FakeClock,
  withDoubles,
} from '../helpers/reservations-doubles.js';
import {
  ControllableDatabaseProbe,
  withDatabaseProbe,
} from '../helpers/health-doubles.js';
import { createTestApp } from '../helpers/test-app.js';
import { CATALOG_CASES } from './catalog.cases.js';
import { CONCERTS_CASES } from './concerts.cases.js';
import { HEALTH_CASES } from './health.cases.js';
import { RESERVATIONS_CASES } from './reservations.cases.js';

/** Medio de pago de prueba: el caso 402 lo hace rechazar (spec 004). */
const gateway = new ControllablePaymentGateway();
/** Reloj de prueba: "completar" exige que el concierto ya haya empezado. */
const clock = new FakeClock();
/** Chequeo de la base de prueba: el caso 503 de /health lo da por caído (spec 007). */
const probe = new ControllableDatabaseProbe();
import type { ContractCase, ContractContext } from './contract-case.js';
import { checkResponse } from './shapes.js';
import { USERS_CASES } from './users.cases.js';

/**
 * Contrato de la API (spec 005, RF-3 a RF-5): cada operación documentada con
 * su caso exitoso y cada código de error que declara. Un caso que no cumple
 * falla con el nombre `operación · código · caso` y la lista de diferencias.
 */
const CASES: readonly ContractCase[] = [
  ...CATALOG_CASES,
  ...USERS_CASES,
  ...CONCERTS_CASES,
  ...RESERVATIONS_CASES,
  ...HEALTH_CASES,
];

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Pares `MÉTODO /ruta · código` que declara el documento OpenAPI. Se usa SOLO
 * como inventario (RF-4): las formas esperadas no salen de acá (RF-5).
 */
function documentedPairs(document: unknown): string[] {
  const paths = isRecord(document) ? document.paths : undefined;
  if (!isRecord(paths)) {
    throw new Error('El documento OpenAPI no tiene "paths"');
  }
  const pairs: string[] = [];
  for (const [path, operations] of Object.entries(paths)) {
    if (!isRecord(operations)) continue;
    for (const method of HTTP_METHODS) {
      const operation = operations[method];
      if (!isRecord(operation) || !isRecord(operation.responses)) continue;
      for (const status of Object.keys(operation.responses)) {
        pairs.push(`${method.toUpperCase()} ${path} · ${status}`);
      }
    }
  }
  return pairs.sort();
}

const casePairs = (): string[] =>
  [...new Set(CASES.map((c) => `${c.operation} · ${c.status}`))].sort();

describe('Contrato de la API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken = '';
  let viewerToken = '';

  beforeAll(async () => {
    app = await createTestApp((builder) =>
      withDatabaseProbe(probe)(withDoubles(gateway, clock)(builder)),
    );
    const users = await seedTestUsers(app);
    adminToken = users.adminToken;
    viewerToken = users.viewerToken;
  });

  afterAll(async () => {
    await app.close();
  });

  const context: ContractContext = {
    http: () => request(app.getHttpServer()),
    asAdmin: (test) => test.set('Authorization', bearer(adminToken)),
    asViewer: (test) => test.set('Authorization', bearer(viewerToken)),
    setPaymentMode: (mode) => {
      gateway.mode = mode;
    },
    setNow: (date) => {
      clock.current = date ?? new Date();
    },
    setDatabaseUp: (up) => {
      probe.up = up;
    },
    async create(base, body) {
      const response = await context
        .asAdmin(context.http().post(base))
        .send(body);
      // En toda respuesta de alta el primer campo es el id (ArtistId, user_id…).
      const created: unknown = response.body;
      const id =
        typeof created === 'object' && created !== null
          ? Object.values(created)[0]
          : undefined;
      if (response.status !== 201 || typeof id !== 'number') {
        throw new Error(
          `No se pudo preparar el caso (${base}): ${response.text}`,
        );
      }
      return id;
    },
  };

  it.each(CASES)('$operation · $status · $name', async (contractCase) => {
    const response = await contractCase.send(context);

    expect(
      checkResponse(response, contractCase.status, contractCase.expected),
    ).toEqual([]);
  });

  describe('inventario contra /docs-json (RF-4)', () => {
    let documented: string[] = [];

    beforeAll(async () => {
      const response = await context.http().get('/docs-json').expect(200);
      documented = documentedPairs(response.body);
    });

    it('toda operación y código documentados tienen al menos un caso', () => {
      const covered = casePairs();
      const missing = documented.filter((pair) => !covered.includes(pair));

      expect(missing).toEqual([]);
    });

    // También protege contra un inventario vacío (si la lectura del documento
    // fallara, todos los casos quedarían "sin documentar" y este test fallaría).
    it('ningún caso apunta a una operación o código que ya no se documenta', () => {
      const stale = casePairs().filter((pair) => !documented.includes(pair));

      expect(stale).toEqual([]);
    });
  });
});
