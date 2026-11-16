import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../../users/entities/user.entity.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';
import { AuthService } from '../auth.service.js';
import { Public } from '../decorators/public.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { RolesGuard } from './roles.guard.js';

/** Controller de mentira: solo sirve para leer los decoradores de cada método. */
class SampleController {
  @Public()
  open(): void {}

  closed(): void {}

  @Roles('admin')
  adminOnly(): void {}
}

@Public()
class PublicController {
  anything(): void {}
}

type Handler = keyof SampleController | 'anything';

function contextFor(
  handler: Handler,
  request: Partial<AuthenticatedRequest>,
): ExecutionContext {
  const target = handler === 'anything' ? PublicController : SampleController;
  const prototype = target.prototype as unknown as Record<string, () => void>;
  return {
    getHandler: () => prototype[handler],
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function user(isAdmin: boolean): User {
  return Object.assign(new User(), { id: 1, isAdmin, disabled: false });
}

describe('AuthenticationGuard (RF-3, RF-5)', () => {
  const auth = { authenticate: vi.fn() };
  const guard = new AuthenticationGuard(
    new Reflector(),
    auth as unknown as AuthService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('una ruta @Public pasa sin mirar la credencial, aunque sea basura (caso 22)', async () => {
    const request = { headers: { authorization: 'Bearer basura' } };

    await expect(guard.canActivate(contextFor('open', request))).resolves.toBe(
      true,
    );
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('@Public en la clase vale para todos sus métodos', async () => {
    await expect(
      guard.canActivate(contextFor('anything', { headers: {} })),
    ).resolves.toBe(true);
    expect(auth.authenticate).not.toHaveBeenCalled();
  });

  it('una ruta SIN decorar exige credencial: protegida por defecto (principio 5)', async () => {
    auth.authenticate.mockRejectedValue(new UnauthorizedException('x'));

    await expect(
      guard.canActivate(contextFor('closed', { headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('con credencial válida deja el usuario en la petición', async () => {
    const authenticated = user(false);
    auth.authenticate.mockResolvedValue(authenticated);
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer token' },
    };

    await expect(
      guard.canActivate(contextFor('closed', request)),
    ).resolves.toBe(true);
    expect(auth.authenticate).toHaveBeenCalledWith('Bearer token');
    expect(request.user).toBe(authenticated);
  });
});

describe('RolesGuard (RF-6)', () => {
  const guard = new RolesGuard(new Reflector());

  it('una ruta sin @Roles no exige rol', () => {
    expect(guard.canActivate(contextFor('closed', { user: user(false) }))).toBe(
      true,
    );
  });

  it('@Roles("admin") con un admin → pasa', () => {
    expect(
      guard.canActivate(contextFor('adminOnly', { user: user(true) })),
    ).toBe(true);
  });

  it('@Roles("admin") con un viewer → 403 Admin privileges required (caso 7)', () => {
    expect(() =>
      guard.canActivate(contextFor('adminOnly', { user: user(false) })),
    ).toThrow(new ForbiddenException('Admin privileges required'));
  });

  it('@Roles sin usuario autenticado → 401 (nunca se deja pasar)', () => {
    expect(() => guard.canActivate(contextFor('adminOnly', {}))).toThrow(
      UnauthorizedException,
    );
  });
});
