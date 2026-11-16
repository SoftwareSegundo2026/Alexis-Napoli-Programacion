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

  /** Operaciones de la API: [ruta, método, operación]. */
  function apiOperations() {
    return Object.entries(document.paths)
      .filter(([path]) => path.startsWith('/api/v1/'))
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

  it('en total son exactamente las 20 rutas de la API', () => {
    expect(apiOperations()).toHaveLength(20);
  });

  it('declara la clave de escritura como header X-API-Key', () => {
    const schemes = Object.values(document.components?.securitySchemes ?? {});

    expect(schemes).toContainEqual(
      expect.objectContaining({
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      }),
    );
  });

  it('las escrituras exigen la clave y las lecturas no', () => {
    for (const { method, operation } of apiOperations()) {
      const requiresKey = (operation.security ?? []).length > 0;
      expect(requiresKey).toBe(WRITE_METHODS.includes(method));
    }
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
