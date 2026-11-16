import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

/** Nombre del esquema de credencial en la documentación (ver `app.setup.ts`). */
export const BEARER_SCHEME = 'bearer';

/**
 * Documenta una operación que exige credencial (spec 002 RF-13): declara el
 * esquema Bearer y el 401. Solo documenta: la protección real la hacen los
 * guards globales.
 */
export function ApiAuthenticated(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(BEARER_SCHEME),
    ApiUnauthorizedResponse({
      type: ErrorResponseDto,
      description:
        'Falta la credencial, es inválida o venció, o el usuario está deshabilitado',
    }),
  );
}

/** Operación que además exige rol admin: suma el 403. */
export function ApiAdminOnly(): MethodDecorator {
  return applyDecorators(
    ApiAuthenticated(),
    ApiForbiddenResponse({
      type: ErrorResponseDto,
      description: 'El usuario no tiene rol admin',
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
