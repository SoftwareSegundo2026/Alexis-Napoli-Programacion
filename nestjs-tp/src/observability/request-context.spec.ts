import { EventEmitter } from 'node:events';
import {
  createRequestContextMiddleware,
  currentRequestId,
  levelFor,
  resolveRequestId,
  type RequestLogger,
} from './request-context.js';

const generated = () => 'generado-0000';

/** Contexto por pedido (spec 007 RF-12, RF-13). */
describe('resolveRequestId (RF-13)', () => {
  it.each(['abc-123', 'A.b_C-9', 'x'.repeat(64)])(
    'respeta un X-Request-Id seguro (%s)',
    (header) => {
      expect(resolveRequestId(header, generated)).toBe(header);
    },
  );

  it.each([
    undefined,
    '',
    'x'.repeat(65),
    'con espacio',
    'comilla"x',
    'salto\nde línea',
    '<script>',
    'ñandú',
  ])('genera uno nuevo si falta o no es seguro (%j)', (header) => {
    expect(resolveRequestId(header, generated)).toBe('generado-0000');
  });
});

describe('levelFor (RF-12)', () => {
  it.each<[number, string, string]>([
    [200, '/api/v1/artists', 'log'],
    [201, '/api/v1/artists', 'log'],
    [304, '/api/v1/artists', 'log'],
    [400, '/api/v1/artists', 'warn'],
    [404, '/api/v1/artists/9', 'warn'],
    [500, '/api/v1/reservations', 'error'],
    [200, '/health', 'debug'],
    [503, '/health', 'error'],
  ])('%i en %s → %s', (status, path, level) => {
    expect(levelFor(status, path)).toBe(level);
  });
});

class FakeResponse extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
}

function createFakeLogger() {
  const calls: Array<{
    level: string;
    message: unknown;
    requestId: string | undefined;
  }> = [];
  // Guarda el requestId visible AL ESCRIBIR: el JsonLogger lo lee de ahí.
  const record =
    (level: string) =>
    (message: unknown): void => {
      calls.push({ level, message, requestId: currentRequestId() });
    };
  const logger: RequestLogger = {
    log: record('log'),
    warn: record('warn'),
    error: record('error'),
    debug: record('debug'),
  };
  return { logger, calls };
}

describe('middleware de contexto (RF-12, RF-13)', () => {
  function run(url: string, header?: string, status = 200) {
    const { logger, calls } = createFakeLogger();
    let time = 100;
    const middleware = createRequestContextMiddleware(logger, {
      generate: generated,
      clock: () => time,
    });
    const request = {
      method: 'GET',
      originalUrl: url,
      header: (name: string) =>
        name.toLowerCase() === 'x-request-id' ? header : undefined,
    };
    const response = new FakeResponse();
    let idInsideRequest: string | undefined;
    middleware(request, response, () => {
      idInsideRequest = currentRequestId();
    });
    response.statusCode = status;
    time = 112.6;
    response.emit('finish');
    return { calls, response, idInsideRequest };
  }

  it('el resto del pedido corre dentro del contexto y el id vuelve en la respuesta', () => {
    const { response, idInsideRequest } = run('/api/v1/genres', 'mi-id-1');
    expect(idInsideRequest).toBe('mi-id-1');
    expect(response.headers.get('X-Request-Id')).toBe('mi-id-1');
  });

  it('fuera de un pedido no hay requestId', () => {
    expect(currentRequestId()).toBeUndefined();
  });

  it('al terminar escribe UNA línea con método, ruta sin query, estado y duración', () => {
    const { calls } = run('/api/v1/tracks/search?q=secreto&skip=0', 'mi-id-2');
    expect(calls).toEqual([
      {
        level: 'log',
        message: {
          message: 'GET /api/v1/tracks/search 200',
          method: 'GET',
          path: '/api/v1/tracks/search',
          statusCode: 200,
          durationMs: 13,
        },
        requestId: 'mi-id-2',
      },
    ]);
  });

  it('el nivel depende del código y /health OK va en debug', () => {
    expect(run('/api/v1/genres/9', undefined, 404).calls[0]?.level).toBe(
      'warn',
    );
    expect(run('/api/v1/reservations', undefined, 500).calls[0]?.level).toBe(
      'error',
    );
    expect(run('/health').calls[0]?.level).toBe('debug');
  });

  it('sin X-Request-Id usa uno generado', () => {
    expect(run('/api/v1/genres').response.headers.get('X-Request-Id')).toBe(
      'generado-0000',
    );
  });
});
