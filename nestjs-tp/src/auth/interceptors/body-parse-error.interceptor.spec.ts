import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { of } from 'rxjs';
import {
  BodyParseErrorInterceptor,
  deferJsonSyntaxError,
  type RequestWithBodyError,
} from './body-parse-error.interceptor.js';

function contextFor(request: Partial<RequestWithBodyError>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('deferJsonSyntaxError (plan 002, decisión 2)', () => {
  it('un JSON malformado NO responde: anota el error y deja seguir hacia los guards', () => {
    const request: Partial<RequestWithBodyError> = { body: { a: 1 } };
    const next = vi.fn();

    deferJsonSyntaxError(
      new SyntaxError('Unexpected end of JSON input'),
      request as Request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(request.bodyParseError).toBe('Unexpected end of JSON input');
    expect(request.body).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('cualquier otro error sigue su camino normal (lo responde el filtro)', () => {
    const error = new Error('payload too large');
    const next = vi.fn();

    deferJsonSyntaxError(
      error,
      {} as Request,
      {} as Response,
      next as unknown as NextFunction,
    );

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe('BodyParseErrorInterceptor', () => {
  const interceptor = new BodyParseErrorInterceptor();
  const handler: CallHandler = { handle: () => of('respuesta') };

  it('sin error anotado deja seguir a la ruta', () => {
    expect(() => interceptor.intercept(contextFor({}), handler)).not.toThrow();
  });

  it('con error anotado lanza el 400 recién ahora (después de 401/403)', () => {
    expect(() =>
      interceptor.intercept(
        contextFor({ bodyParseError: 'Unexpected end of JSON input' }),
        handler,
      ),
    ).toThrow(new BadRequestException('Unexpected end of JSON input'));
  });
});
