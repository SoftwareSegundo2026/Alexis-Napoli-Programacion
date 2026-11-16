import { SetMetadata } from '@nestjs/common';
import type { Role } from '../authenticated-request.js';

export const ROLES_KEY = 'roles';

/** Rol que exige una ruta (spec 002 RF-6). Sin este decorador, alcanza con estar autenticado. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
