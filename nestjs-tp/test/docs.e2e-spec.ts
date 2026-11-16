import { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { createTestApp } from './helpers/test-app.js';

type Method = 'get' | 'post' | 'patch' | 'delete' | 'put';

const RESOURCES = ['artists', 'albums', 'genres', 'tracks'];
const WRITE_METHODS: Method[] = ['post', 'patch', 'delete'];

describe('Documentación interactiva (e2e) — RF-14', () => {
  let app: INestApplication<App>;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createTestApp();
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    document = response.body as OpenAPIObject;
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * Operaciones del CATÁLOGO: [ruta, método, operación]. (Desde la spec 002 la
   * API también tiene login y usuarios; esos se verifican aparte.)
   */
  function apiOperations() {
    return Object.entries(document.paths)
      .filter(([path]) =>
        RESOURCES.some((resource) => path.startsWith(`/api/v1/${resource}`)),
      )
      .flatMap(([path, item]) =>
        (['get', 'post', 'patch', 'delete', 'put'] as Method[])
          .filter((method) => item[method] !== undefined)
          .map((method) => ({ path, method, operation: item[method]! })),
      );
  }

  it('la página interactiva responde en /docs', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs')
      .expect(200);

    expect(response.type).toBe('text/html');
  });

  it.each(RESOURCES)('documenta las 5 rutas de /%s', (resource) => {
    const list = document.paths[`/api/v1/${resource}`];
    const byId = document.paths[`/api/v1/${resource}/{id}`];

    expect(Object.keys(list).sort()).toEqual(['get', 'post']);
    expect(
      Object.keys(byId)
        .filter((key) => key !== 'parameters')
        .sort(),
    ).toEqual(['delete', 'get', 'patch']);
  });

  it('el catálogo son exactamente 20 rutas', () => {
    expect(apiOperations()).toHaveLength(20);
  });

  it('documenta el login como operación pública: sin esquema de seguridad (spec 002 RF-5)', () => {
    const login = document.paths['/api/v1/auth/token']?.post;

    expect(login).toBeDefined();
    expect(login?.security ?? []).toEqual([]);
  });

  // Spec 002 RF-13 (reemplaza la parte de la RF-14 de la spec 001 que
  // declaraba la clave X-API-Key).
  it('declara la credencial Bearer y ya no la clave X-API-Key (RF-13, RF-12)', () => {
    const schemes = Object.values(document.components?.securitySchemes ?? {});

    expect(schemes).toContainEqual(
      expect.objectContaining({ type: 'http', scheme: 'bearer' }),
    );
    expect(schemes).not.toContainEqual(
      expect.objectContaining({ name: 'X-API-Key' }),
    );
  });

  it('en el catálogo las escrituras exigen Bearer y las lecturas no', () => {
    for (const { method, operation } of apiOperations()) {
      const requiresBearer = (operation.security ?? []).some(
        (requirement) => 'bearer' in requirement,
      );
      expect(requiresBearer).toBe(WRITE_METHODS.includes(method));
    }
  });

  it('documenta las 4 operaciones de usuarios, todas con Bearer (RF-13)', () => {
    const operations = [
      document.paths['/api/v1/users']?.get,
      document.paths['/api/v1/users']?.post,
      document.paths['/api/v1/users/me']?.get,
      document.paths['/api/v1/users/{id}']?.patch,
    ];

    for (const operation of operations) {
      expect(operation).toBeDefined();
      expect(operation?.security).toEqual([{ bearer: [] }]);
    }
  });

  it('en total la API son 25 operaciones: 20 del catálogo, el login y 4 de usuarios', () => {
    const all = Object.entries(document.paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
      .flatMap(([, item]) =>
        (['get', 'post', 'patch', 'delete', 'put'] as Method[]).filter(
          (method) => item[method] !== undefined,
        ),
      );

    expect(all).toHaveLength(25);
  });

  it('el esquema de usuario no expone la contraseña ni el hash (RNF-1)', () => {
    const schemas = document.components?.schemas ?? {};
    const userFields = Object.keys(
      (schemas.UserResponseDto as { properties?: object } | undefined)
        ?.properties ?? {},
    ).sort();

    expect(userFields).toEqual([
      'disabled',
      'email',
      'full_name',
      'is_admin',
      'user_id',
      'username',
    ]);
    expect(
      Object.keys(
        (schemas.TokenResponseDto as { properties?: object } | undefined)
          ?.properties ?? {},
      ).sort(),
    ).toEqual(['access_token', 'token_type']);
  });

  it('los listados documentan skip y limit', () => {
    for (const resource of RESOURCES) {
      const names = (
        document.paths[`/api/v1/${resource}`].get?.parameters ?? []
      )
        .map((parameter) => ('name' in parameter ? parameter.name : ''))
        .sort();
      expect(names).toEqual(['limit', 'skip']);
    }
  });

  it('los esquemas de respuesta tienen los campos del contrato', () => {
    const schemas = document.components?.schemas ?? {};
    const fields = (name: string) =>
      Object.keys(
        (schemas[name] as { properties?: object } | undefined)?.properties ??
          {},
      ).sort();

    expect(fields('GenreResponseDto')).toEqual(['GenreId', 'Name']);
    expect(fields('ArtistResponseDto')).toEqual([
      'ArtistId',
      'ImageUrl',
      'Name',
    ]);
    expect(fields('AlbumResponseDto')).toEqual([
      'AlbumId',
      'ArtistId',
      'ArtistName',
      'ImageUrl',
      'Title',
    ]);
    expect(fields('TrackResponseDto')).toEqual([
      'AlbumId',
      'AlbumTitle',
      'Bytes',
      'Composer',
      'GenreId',
      'GenreName',
      'MediaTypeId',
      'MediaTypeName',
      'Milliseconds',
      'Name',
      'TrackId',
      'UnitPrice',
    ]);
    expect(fields('ErrorResponseDto')).toEqual(['detail']);
  });
});
