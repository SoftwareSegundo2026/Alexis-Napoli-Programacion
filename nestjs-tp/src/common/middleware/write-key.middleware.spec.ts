import { UnauthorizedException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  createWriteKeyMiddleware,
  isValidWriteKey,
} from './write-key.middleware.js';

const EXPECTED_KEY = 'clave-correcta';

function requestWith(
  method: string,
  headers: Record<string, string | string[]> = {},
): Request {
  return { method, headers } as unknown as Request;
}

/** Corre el middleware y devuelve con qué se llamó a `next`. */
function run(request: Request): unknown[] {
  const middleware = createWriteKeyMiddleware(EXPECTED_KEY);
  const next = vi.fn();
  middleware(request, {} as Response, next as unknown as NextFunction);
  expect(next).toHaveBeenCalledTimes(1);
  return next.mock.calls[0];
}

describe('isValidWriteKey', () => {
  it('acepta solo la clave exacta', () => {
    expect(isValidWriteKey(EXPECTED_KEY, EXPECTED_KEY)).toBe(true);
    expect(isValidWriteKey('clave-incorrecta', EXPECTED_KEY)).toBe(false);
    expect(isValidWriteKey('CLAVE-CORRECTA', EXPECTED_KEY)).toBe(false);
    expect(isValidWriteKey(`${EXPECTED_KEY} `, EXPECTED_KEY)).toBe(false);
  });

  it('rechaza una clave de otro largo, vacía o ausente', () => {
    expect(isValidWriteKey('corta', EXPECTED_KEY)).toBe(false);
    expect(isValidWriteKey('', EXPECTED_KEY)).toBe(false);
    expect(isValidWriteKey(undefined, EXPECTED_KEY)).toBe(false);
  });

  it('rechaza el header repetido (llega como lista)', () => {
    expect(isValidWriteKey([EXPECTED_KEY, EXPECTED_KEY], EXPECTED_KEY)).toBe(
      false,
    );
  });
});

describe('createWriteKeyMiddleware (RF-11)', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])(
    '%s sin clave pasa (lectura libre)',
    (method) => {
      expect(run(requestWith(method))).toEqual([]);
    },
  );

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    '%s sin clave → 401',
    (method) => {
      const [error] = run(requestWith(method));

      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).getStatus()).toBe(401);
    },
  );

  it('una escritura con clave vacía o incorrecta → 401', () => {
    expect(run(requestWith('POST', { 'x-api-key': '' }))[0]).toBeInstanceOf(
      UnauthorizedException,
    );
    expect(
      run(requestWith('DELETE', { 'x-api-key': 'otra-clave' }))[0],
    ).toBeInstanceOf(UnauthorizedException);
  });

  it('una escritura con la clave correcta pasa', () => {
    expect(run(requestWith('PATCH', { 'x-api-key': EXPECTED_KEY }))).toEqual(
      [],
    );
  });

  it('no acepta una configuración sin clave', () => {
    expect(() => createWriteKeyMiddleware('')).toThrow(/WRITE_API_KEY/);
  });
});
