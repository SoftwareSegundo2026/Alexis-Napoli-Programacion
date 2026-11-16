import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiSecurity,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

/** Nombre del esquema de seguridad de la clave de escritura (ver `app.setup.ts`). */
export const WRITE_KEY_SCHEME = 'write-key';

/**
 * Documenta una operación de escritura: exige `X-API-Key` y puede responder 401.
 * Solo documenta: la protección real la hace el middleware global (RF-11).
 */
export function ApiWriteOperation(): MethodDecorator {
  return applyDecorators(
    ApiSecurity(WRITE_KEY_SCHEME),
    ApiUnauthorizedResponse({
      type: ErrorResponseDto,
      description: 'Falta la clave de escritura o es incorrecta',
    }),
  );
}

export function ApiInvalidRequest(): MethodDecorator {
  return ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Datos, paginación o id con formato inválido',
  });
}

export function ApiNotFound(): MethodDecorator {
  return ApiNotFoundResponse({
    type: ErrorResponseDto,
    description: 'El recurso no existe',
  });
}

export function ApiConflict(description: string): MethodDecorator {
  return ApiConflictResponse({ type: ErrorResponseDto, description });
}
