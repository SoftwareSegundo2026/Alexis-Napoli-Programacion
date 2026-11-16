import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../../users/entities/user.entity.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { INVALID_CREDENTIALS } from '../auth.service.js';

/**
 * Inyecta en el controller al usuario autenticado (el que dejó el guard).
 * Solo tiene sentido en rutas protegidas; si no hubiera usuario → 401.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user === undefined) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return user;
  },
);
