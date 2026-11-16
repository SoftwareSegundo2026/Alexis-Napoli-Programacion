import { JsonLogger, type LogLevelName } from './json-logger.js';
import { REDACTED } from './sanitize.js';

const NOW = new Date('2026-11-16T03:00:00.000Z');

/** Logger que escribe en un arreglo; devuelve las líneas ya parseadas. */
function createLogger(
  level: LogLevelName = 'verbose',
  requestId: () => string | undefined = () => undefined,
) {
  const lines: string[] = [];
  const logger = new JsonLogger({
    level,
    write: (line) => lines.push(line),
    now: () => NOW,
    requestId,
  });
  const records = (): Array<Record<string, unknown>> =>
    lines.map((line) => {
      expect(line.endsWith('\n')).toBe(true);
      expect(line.trimEnd()).not.toContain('\n'); // una línea por evento
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error(`No es un objeto JSON: ${line}`);
      }
      return { ...parsed };
    });
  return { logger, lines, records };
}

/** Logger JSON (spec 007 RF-11, RF-14, RF-15). */
describe('JsonLogger', () => {
  it('escribe una línea JSON con timestamp, nivel, contexto y mensaje', () => {
    const { logger, records } = createLogger();
    logger.log('Aplicación lista', 'Bootstrap');
    expect(records()).toEqual([
      {
        timestamp: '2026-11-16T03:00:00.000Z',
        level: 'log',
        context: 'Bootstrap',
        message: 'Aplicación lista',
      },
    ]);
  });

  it('agrega el requestId cuando el evento ocurre durante un pedido', () => {
    const { logger, records } = createLogger('log', () => 'req-123');
    logger.warn('algo raro', 'HTTP');
    expect(records()[0]).toMatchObject({ level: 'warn', requestId: 'req-123' });
  });

  it('sin pedido en curso no inventa un requestId', () => {
    const { logger, records } = createLogger();
    logger.log('arranque');
    expect(records()[0]).not.toHaveProperty('requestId');
    expect(records()[0]).not.toHaveProperty('context');
  });

  it('error con stack y contexto (como lo llama Nest)', () => {
    const { logger, records } = createLogger();
    logger.error(
      'falló',
      'Error: falló\n    at algo (archivo.ts:1:2)',
      'Filtro',
    );
    expect(records()[0]).toEqual({
      timestamp: '2026-11-16T03:00:00.000Z',
      level: 'error',
      context: 'Filtro',
      message: 'falló',
      stack: 'Error: falló\n    at algo (archivo.ts:1:2)',
    });
  });

  it('error con un stack y sin contexto', () => {
    const { logger, records } = createLogger();
    logger.error('falló', 'Error: x\n    at f (a.ts:1:1)');
    expect(records()[0]).toEqual({
      timestamp: '2026-11-16T03:00:00.000Z',
      level: 'error',
      message: 'falló',
      stack: 'Error: x\n    at f (a.ts:1:1)',
    });
  });

  it('error con un solo texto extra que no es un stack: es el contexto', () => {
    const { logger, records } = createLogger();
    logger.error('falló', 'Filtro');
    expect(records()[0]).toMatchObject({ context: 'Filtro' });
    expect(records()[0]).not.toHaveProperty('stack');
  });

  it('un objeto Error como mensaje aporta su mensaje y su stack', () => {
    const { logger, records } = createLogger();
    const error = new Error('se rompió');
    logger.error(error, 'Filtro');
    expect(records()[0]).toMatchObject({
      message: 'se rompió',
      context: 'Filtro',
      stack: error.stack,
    });
  });

  it('un objeto como mensaje aporta sus campos (log del pedido)', () => {
    const { logger, records } = createLogger();
    logger.log(
      { message: 'GET /api/v1/artists 200', statusCode: 200, durationMs: 3 },
      'HTTP',
    );
    expect(records()[0]).toMatchObject({
      context: 'HTTP',
      message: 'GET /api/v1/artists 200',
      statusCode: 200,
      durationMs: 3,
    });
  });

  it('nunca escribe datos sensibles: ni en el mensaje, ni en campos, ni en el stack (caso 4)', () => {
    const { logger, lines } = createLogger();
    logger.error(
      {
        message: 'login falló con password=hunter2',
        authorization: 'Bearer abc.def.ghi',
      },
      'Error: token=secreto-1\n    at f (a.ts:1:1)',
      'Auth',
    );
    const line = lines.join('');
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('abc.def.ghi');
    expect(line).not.toContain('secreto-1');
    expect(line).toContain(REDACTED);
  });

  it.each<[LogLevelName, string[]]>([
    ['fatal', ['fatal']],
    ['error', ['fatal', 'error']],
    ['warn', ['fatal', 'error', 'warn']],
    ['log', ['fatal', 'error', 'warn', 'log']],
    ['debug', ['fatal', 'error', 'warn', 'log', 'debug']],
    ['verbose', ['fatal', 'error', 'warn', 'log', 'debug', 'verbose']],
  ])('con LOG_LEVEL=%s escribe solo %j (RF-15, caso 15)', (level, expected) => {
    const { logger, records } = createLogger(level);
    logger.fatal('m');
    logger.error('m');
    logger.warn('m');
    logger.log('m');
    logger.debug('m');
    logger.verbose('m');
    expect(records().map((record) => record.level)).toEqual(expected);
  });

  it('mensajes que no son texto se convierten a texto', () => {
    const { logger, records } = createLogger();
    logger.log(42);
    expect(records()[0]).toMatchObject({ message: '42' });
  });
});
