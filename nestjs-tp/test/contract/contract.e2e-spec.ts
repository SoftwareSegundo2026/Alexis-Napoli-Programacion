import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { bearer, seedTestUsers } from '../helpers/auth.js';
import { createTestApp } from '../helpers/test-app.js';
import { CATALOG_CASES } from './catalog.cases.js';
import type { ContractCase, ContractContext } from './contract-case.js';
import { checkResponse } from './shapes.js';

/**
 * Contrato de la API (spec 005, RF-3 a RF-5): cada operación documentada con
 * su caso exitoso y cada código de error que declara. Un caso que no cumple
 * falla con el nombre `operación · código · caso` y la lista de diferencias.
 */
const CASES: readonly ContractCase[] = [...CATALOG_CASES];

describe('Contrato de la API (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken = '';
  let viewerToken = '';

  beforeAll(async () => {
    app = await createTestApp();
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
    async create(base, body) {
      const response = await context
        .asAdmin(context.http().post(base))
        .send(body);
      // En toda respuesta del catálogo el primer campo es el id (ArtistId, AlbumId…).
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
});
