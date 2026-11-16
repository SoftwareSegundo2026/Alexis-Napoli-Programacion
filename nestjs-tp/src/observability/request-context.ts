import { Logger } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

/**
 * Contexto por pedido (spec 007 RF-12, RF-13).
 *
 * `AsyncLocalStorage` es una "variable por pedido": todo lo que corre a
 * partir de `storage.run(...)` (incluido lo asíncrono: consultas, el filtro de
 * errores…) ve el mismo valor, sin pasarlo de función en función. Así el
 * `JsonLogger` agrega el `requestId` a cualquier línea escrita durante el pedido.
 */
interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Ruta del chequeo de salud: su 200 va en `debug` para no llenar los logs. */
export const HEALTH_PATH = '/health';

/**
 * Un id que llega del cliente se acepta solo si es corto y "inofensivo": sin
 * espacios, comillas ni saltos de línea, que permitirían inventar líneas de log.
 */
const SAFE_REQUEST_ID = /^[\w.-]{1,64}$/;

/** `requestId` del pedido en curso; `undefined` fuera de un pedido. */
export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

/** El `X-Request-Id` del cliente si es seguro; si no, uno nuevo. */
export function resolveRequestId(
  header: string | undefined,
  generate: () => string = randomUUID,
): string {
  return header !== undefined && SAFE_REQUEST_ID.test(header)
    ? header
    : generate();
}

export type RequestLogLevel = 'log' | 'warn' | 'error' | 'debug';

/** Nivel de la línea del pedido según el resultado (RF-12). */
export function levelFor(statusCode: number, path: string): RequestLogLevel {
  if (statusCode >= 500) {
    return 'error';
  }
  if (statusCode >= 400) {
    return 'warn';
  }
  return path === HEALTH_PATH ? 'debug' : 'log';
}

/** Lo que el middleware usa del pedido (lo cumple el `Request` de Express). */
export interface ContextRequest {
  method: string;
  originalUrl: string;
  header(name: string): string | undefined;
}

/** Lo que el middleware usa de la respuesta (lo cumple el `Response` de Express). */
export interface ContextResponse {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  once(event: 'finish', listener: () => void): unknown;
}

export type RequestLogger = Record<
  RequestLogLevel,
  (message: Record<string, unknown>) => void
>;

export interface RequestContextOptions {
  generate?: () => string;
  /** Milisegundos (los tests lo fijan). */
  clock?: () => number;
}

/**
 * Middleware de Express: asigna el `requestId`, lo devuelve en la respuesta,
 * corre el resto del pedido dentro del contexto y, al terminar, escribe UNA
 * línea con método, ruta (sin query: puede traer datos), estado y duración.
 * Nunca registra cuerpos ni headers (RF-14).
 */
export function createRequestContextMiddleware(
  logger: RequestLogger = new Logger('HTTP'),
  {
    generate = randomUUID,
    clock = () => performance.now(),
  }: RequestContextOptions = {},
) {
  return (
    request: ContextRequest,
    response: ContextResponse,
    next: () => void,
  ): void => {
    const context: RequestContext = {
      requestId: resolveRequestId(request.header(REQUEST_ID_HEADER), generate),
    };
    const startedAt = clock();
    response.setHeader(REQUEST_ID_HEADER, context.requestId);

    response.once('finish', () => {
      // El evento llega desde el servidor HTTP, fuera del contexto: se vuelve a entrar.
      storage.run(context, () => {
        const path = request.originalUrl.split('?')[0] ?? '';
        const { statusCode } = response;
        logger[levelFor(statusCode, path)]({
          message: `${request.method} ${path} ${statusCode}`,
          method: request.method,
          path,
          statusCode,
          durationMs: Math.round(clock() - startedAt),
        });
      });
    });

    storage.run(context, next);
  };
}
