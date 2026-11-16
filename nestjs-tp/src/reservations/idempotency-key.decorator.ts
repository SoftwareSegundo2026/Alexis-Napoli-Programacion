import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Header `Idempotency-Key` obligatorio, de 8 a 100 caracteres (spec 004 RF-6,
 * caso 10). Es un decorador de parámetro (y no un pipe) porque `@Headers()` de
 * Nest no acepta pipes. Se resuelve después de los guards: sin credencial
 * sigue siendo 401.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const value = context
      .switchToHttp()
      .getRequest<Request>()
      .header('idempotency-key');
    if (value === undefined || value.length < 8 || value.length > 100) {
      throw new BadRequestException(
        'Idempotency-Key header is required (8 to 100 characters)',
      );
    }
    return value;
  },
);
