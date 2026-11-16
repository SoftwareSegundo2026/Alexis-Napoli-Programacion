import type { Request } from 'express';
import { User } from '../users/entities/user.entity.js';

/** Petición HTTP después del guard de autenticación: lleva al usuario de la base. */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/** Roles del sistema (spec 002): se derivan de `User.isAdmin`. */
export type Role = 'admin' | 'viewer';

export function roleOf(user: User): Role {
  return user.isAdmin ? 'admin' : 'viewer';
}
