import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { Observable } from 'rxjs';

/** Petición cuyo cuerpo no era JSON válido: se anota el error para después. */
export interface RequestWithBodyError extends Request {
  bodyParseError?: string;
}

/**
 * Manejador de errores de Express que va justo detrás del lector de JSON
 * (plan 002, decisión 2). El lector corre ANTES que los guards; si respondiera
 * el 400 ahí, un JSON malformado sin credencial daría 400 en vez de 401, y un
 * viewer recibiría 400 en vez de 403. Por eso no responde: anota el error,
 * vacía el cuerpo y deja seguir la petición hacia los guards.
 */
export function deferJsonSyntaxError(
  error: unknown,
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (error instanceof SyntaxError) {
    (request as RequestWithBodyError).bodyParseError = error.message;
    request.body = undefined;
    next();
    return;
  }
  next(error);
}

/**
 * Lanza el 400 del JSON malformado. Los interceptores corren DESPUÉS de los
 * guards, así que el orden 401 → 403 → 400 de la spec queda garantizado.
 */
@Injectable()
export class BodyParseErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithBodyError>();
    if (request.bodyParseError !== undefined) {
      throw new BadRequestException(request.bodyParseError);
    }
    return next.handle();
  }
}
