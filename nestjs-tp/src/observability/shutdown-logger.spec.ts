import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JsonLogger } from './json-logger.js';
import { ShutdownLogger } from './shutdown-logger.js';

/** Apagado ordenado (spec 007 RF-16, caso 16). */
describe('ShutdownLogger', () => {
  let lines: string[];
  let logger: JsonLogger;

  beforeEach(() => {
    lines = [];
    logger = new JsonLogger({
      level: 'log',
      write: (line) => lines.push(line),
    });
    Logger.overrideLogger(logger);
  });

  afterEach(() => {
    Logger.overrideLogger(false);
  });

  const shutdownRecords = () =>
    lines
      .map((line): unknown => JSON.parse(line))
      .filter(
        (record): record is Record<string, unknown> =>
          typeof record === 'object' &&
          record !== null &&
          'context' in record &&
          record.context === 'Shutdown',
      );

  it('registra la señal al empezar y el fin del apagado, con nivel log', () => {
    const shutdown = new ShutdownLogger();
    shutdown.beforeApplicationShutdown('SIGTERM');
    shutdown.onApplicationShutdown();

    expect(
      shutdownRecords().map((record) => [record.level, record.message]),
    ).toEqual([
      [
        'log',
        'Apagado ordenado (SIGTERM): no se aceptan pedidos nuevos; se terminan los que están en curso',
      ],
      ['log', 'Apagado completo: servidor y base cerrados'],
    ]);
  });

  it('al cerrar la app, Nest llama a los dos hooks (sin señal: cierre por código)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ShutdownLogger],
    }).compile();
    // Sin `logger`, la app volvería al logger por defecto de Nest.
    const app = moduleRef.createNestApplication({ logger });
    await app.init();
    await app.close();

    const messages = shutdownRecords().map((record) => record.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain('(cierre de la aplicación)');
    expect(messages[1]).toContain('Apagado completo');
  });
});
