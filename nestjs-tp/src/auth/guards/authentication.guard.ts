import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { AuthService } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Guard GLOBAL de autenticación (spec 002 RF-3 a RF-5). Toda ruta exige una
 * credencial válida salvo que esté declarada `@Public()`: así, una ruta nueva
 * que alguien olvide decorar queda protegida (principio 5 de la constitution).
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic === true) {
      // En lo público la credencial se ignora (caso 22): ni se valida.
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.auth.authenticate(request.headers.authorization);
    return true;
  }
}
