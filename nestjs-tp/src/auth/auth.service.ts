import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity.js';
import { PasswordHasher } from '../users/password-hasher.js';
import { UsersRepository } from '../users/users.repository.js';

/** Mismo mensaje para usuario inexistente, contraseña mala o deshabilitado (RF-2). */
export const INVALID_LOGIN = 'Incorrect username or password';
/** Mismo mensaje para cualquier problema de la credencial (RF-3). */
export const INVALID_CREDENTIALS = 'Could not validate credentials';
export const INACTIVE_USER = 'Inactive user';

/** Lo que va dentro de la credencial: solo QUIÉN es (`sub` = id). Nada más. */
interface TokenPayload {
  sub: string;
}

/** `Bearer <credencial>`; el nombre del esquema no distingue mayúsculas (caso 12). */
const BEARER = /^Bearer\s+(\S+)\s*$/i;

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Login (RF-1, RF-2). Si el usuario no existe o está deshabilitado igual se
   * hace una verificación de contraseña (contra la referencia) antes del 401,
   * para que el tiempo no delate si la cuenta existe (RNF-4).
   */
  async login(username: string, password: string): Promise<string> {
    const user = await this.users.findByUsernameWithPassword(username);
    if (user === null || user.disabled || user.hashedPassword === undefined) {
      await this.hasher.verifyAgainstReference(password);
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    if (!(await this.hasher.verify(password, user.hashedPassword))) {
      throw new UnauthorizedException(INVALID_LOGIN);
    }
    return this.issueToken(user);
  }

  /** Credencial firmada (HS256) que vence según `JWT_EXPIRES_MINUTES`. */
  issueToken(user: User): Promise<string> {
    const payload: TokenPayload = { sub: String(user.id) };
    return this.jwt.signAsync(payload);
  }

  /**
   * Valida el header `Authorization` y devuelve el usuario ACTUAL de la base
   * (RF-3, RF-4). El estado y el rol se leen acá en cada petición: deshabilitar
   * o quitar el rol rige aunque la credencial siga vigente.
   */
  async authenticate(authorization: string | undefined): Promise<User> {
    const token = BEARER.exec(authorization ?? '')?.[1];
    if (token === undefined) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const userId = await this.userIdFrom(token);
    const user = await this.users.findById(userId);
    if (user === null) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (user.disabled) {
      throw new UnauthorizedException(INACTIVE_USER);
    }
    return user;
  }

  /** Firma, algoritmo y vencimiento; cualquier falla → el mismo 401. */
  private async userIdFrom(token: string): Promise<number> {
    let payload: Partial<TokenPayload>;
    try {
      payload = await this.jwt.verifyAsync<Partial<TokenPayload>>(token);
    } catch {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (typeof payload.sub !== 'string' || !/^\d+$/.test(payload.sub)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    return Number(payload.sub);
  }
}
