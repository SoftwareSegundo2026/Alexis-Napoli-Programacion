import { UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/** Header donde el editor presenta la clave (Express lo normaliza a minúsculas). */
export const WRITE_KEY_HEADER = 'x-api-key';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Compara la clave recibida con la esperada en tiempo constante, para que el
 * tiempo de respuesta no revele cuántos caracteres coinciden. Se comparan los
 * hash SHA-256 porque `timingSafeEqual` exige dos valores del mismo largo.
 */
export function isValidWriteKey(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided === '') {
    return false;
  }
  const providedHash = createHash('sha256').update(provided).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

/**
 * Clave de escritura global (RF-11): toda alta, modificación o baja exige
 * `X-API-Key`; las lecturas pasan libres. Al ser global, una ruta de escritura
 * nueva queda protegida aunque nadie se acuerde de protegerla.
 *
 * Es un middleware (y no un guard) porque tiene que correr ANTES de que Express
 * lea el cuerpo: así un JSON malformado sin clave responde 401 y no 400
 * (prioridad 401 → 400 de la spec). Se registra en `configureApp`.
 *
 * El error se pasa a `next()`: lo responde el filtro global con `{"detail"}`.
 */
export function createWriteKeyMiddleware(expectedKey: string): RequestHandler {
  if (expectedKey === '') {
    throw new Error('WRITE_API_KEY no puede estar vacía.');
  }

  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!WRITE_METHODS.has(request.method)) {
      next();
      return;
    }
    if (!isValidWriteKey(request.headers[WRITE_KEY_HEADER], expectedKey)) {
      next(new UnauthorizedException('Missing or invalid write key'));
      return;
    }
    next();
  };
}
