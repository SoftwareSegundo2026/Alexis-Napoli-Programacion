import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  roleOf,
  type AuthenticatedRequest,
  type Role,
} from '../authenticated-request.js';
import { INVALID_CREDENTIALS } from '../auth.service.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

/**
 * Guard GLOBAL de roles (spec 002 RF-6). Corre después del de autenticación:
 * si la ruta declara `@Roles(...)` y el rol vigente del usuario no está, 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (required === undefined || required.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (user === undefined) {
      // Una ruta con rol nunca se atiende sin usuario (p. ej. si se la marcó @Public por error).
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!required.includes(roleOf(user))) {
      throw new ForbiddenException('Admin privileges required');
    }
    return true;
  }
}
