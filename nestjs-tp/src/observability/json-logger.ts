import type { LoggerService } from '@nestjs/common';
import { sanitize, sanitizeValue } from './sanitize.js';

/** Niveles de Nest, del más grave al menos grave (spec 007 RF-15). */
export const LOG_LEVELS = [
  'fatal',
  'error',
  'warn',
  'log',
  'debug',
  'verbose',
] as const;

export type LogLevelName = (typeof LOG_LEVELS)[number];

export interface JsonLoggerOptions {
  /** Nivel mínimo: se escriben ese nivel y los más graves. */
  level: LogLevelName;
  /** Dónde va cada línea (en producción, la salida estándar). */
  write: (line: string) => void;
  /** Reloj; los tests lo fijan. */
  now?: () => Date;
  /** `requestId` del pedido en curso, si lo hay (spec 007 RF-13). */
  requestId?: () => string | undefined;
}

/** Un stack de Node: primera línea y al menos una línea `at archivo:línea:columna`. */
const STACK = /^.+\n\s+at .+:\d+:\d+/s;

/**
 * Logger de la aplicación (spec 007 RF-11): una línea JSON por evento, con
 * `timestamp` (ISO 8601, UTC), `level`, `context`, `requestId` (si el evento
 * ocurre durante un pedido) y `message`, más los campos que traiga un mensaje
 * objeto y el `stack` de los errores. Todo pasa por el saneo (RF-14).
 *
 * Reemplaza al logger de Nest con `app.useLogger(...)`: así los mensajes de
 * Nest y los de la app (todos usan `Logger`) salen con el mismo formato.
 */
export class JsonLogger implements LoggerService {
  private readonly maxSeverity: number;
  private readonly now: () => Date;
  private readonly requestId: () => string | undefined;

  constructor(private readonly options: JsonLoggerOptions) {
    this.maxSeverity = LOG_LEVELS.indexOf(options.level);
    this.now = options.now ?? (() => new Date());
    this.requestId = options.requestId ?? (() => undefined);
  }

  fatal(message: unknown, ...params: unknown[]): void {
    this.write('fatal', message, ...splitError(params));
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, ...splitError(params));
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, contextOf(params));
  }

  log(message: unknown, ...params: unknown[]): void {
    this.write('log', message, contextOf(params));
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, contextOf(params));
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('verbose', message, contextOf(params));
  }

  private write(
    level: LogLevelName,
    message: unknown,
    context?: string,
    stack?: string,
  ): void {
    if (LOG_LEVELS.indexOf(level) > this.maxSeverity) {
      return;
    }
    const { text, fields, errorStack } = describe(message);
    const record: Record<string, unknown> = {
      timestamp: this.now().toISOString(),
      level,
    };
    if (context !== undefined) {
      record.context = context;
    }
    const requestId = this.requestId();
    if (requestId !== undefined) {
      record.requestId = requestId;
    }
    record.message = sanitize(text);
    Object.assign(record, sanitizeValue(fields));
    const finalStack = stack ?? errorStack;
    if (finalStack !== undefined) {
      record.stack = sanitize(finalStack);
    }
    // JSON.stringify escapa los saltos de línea: siempre UNA línea por evento.
    this.options.write(`${JSON.stringify(record)}\n`);
  }
}

/** El último parámetro de texto es el contexto (convención de `Logger` de Nest). */
function contextOf(params: unknown[]): string | undefined {
  const last = params.at(-1);
  return typeof last === 'string' ? last : undefined;
}

/**
 * Parámetros de `error`/`fatal` como los pasa Nest: `(stack, context)`,
 * `(context)` o `(stack)`; un único texto es stack solo si tiene forma de stack.
 */
function splitError(
  params: unknown[],
): [string | undefined, string | undefined] {
  const texts = params.filter((param) => typeof param === 'string');
  if (texts.length >= 2) {
    return [texts[1], texts[0]];
  }
  const [only] = texts;
  if (only !== undefined && STACK.test(only)) {
    return [undefined, only];
  }
  return [only, undefined];
}

/** Separa un mensaje en texto, campos extra (mensaje objeto) y stack (Error). */
function describe(message: unknown): {
  text: string;
  fields: Record<string, unknown>;
  errorStack?: string;
} {
  if (message instanceof Error) {
    return { text: message.message, fields: {}, errorStack: message.stack };
  }
  if (typeof message === 'object' && message !== null) {
    let text = '';
    const fields: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(message)) {
      if (key === 'message') {
        text = String(value);
      } else {
        fields[key] = value;
      }
    }
    return { text, fields };
  }
  return { text: String(message), fields: {} };
}
