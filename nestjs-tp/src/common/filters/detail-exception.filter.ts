import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

/** Cuerpo de todo error de la API, igual que en el servicio original. */
export interface ErrorBody {
  detail: string;
}

const GENERIC_ERROR = 'Internal Server Error';

/**
 * Filtro global: cualquier error sale como `{"detail": "<mensaje>"}`.
 *
 * - `HttpException` (400, 401, 404, 409…): conserva el código y usa su mensaje.
 *   El JSON malformado también llega acá: el adaptador de Express de Nest lo
 *   convierte en `BadRequestException` antes de llamar a los filtros.
 * - Cualquier otro error: 500 con un mensaje genérico. El detalle real se
 *   registra en el log, pero nunca se envía al cliente (RNF-2).
 */
@Catch()
export class DetailExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DetailExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status === HttpStatus.UNAUTHORIZED) {
        // Estándar HTTP: un 401 anuncia qué esquema de credencial se espera (spec 002).
        response.setHeader('WWW-Authenticate', 'Bearer');
      }
      const body: ErrorBody = { detail: detailOf(exception) };
      response.status(status).json(body);
      return;
    }

    this.logger.error(
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : String(exception),
    );
    const body: ErrorBody = { detail: GENERIC_ERROR };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }
}

/** Mensaje legible de una HttpException; si trae una lista, el primero. */
function detailOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if ('message' in response) {
    const { message } = response;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && typeof message[0] === 'string') {
      return message[0];
    }
  }
  return exception.message;
}
