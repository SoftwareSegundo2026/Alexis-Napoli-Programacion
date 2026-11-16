import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, getRounds, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';

/**
 * Hash de contraseñas con sal (bcrypt). Nunca se guarda ni se compara la
 * contraseña en claro: se guarda el hash y se verifica contra él.
 */
@Injectable()
export class PasswordHasher {
  private readonly rounds: number;
  private referenceHash?: Promise<string>;

  constructor(config: ConfigService) {
    this.rounds = config.getOrThrow<number>('PASSWORD_HASH_ROUNDS');
  }

  /** Hash con sal nueva cada vez: la misma contraseña da hashes distintos. */
  hash(password: string): Promise<string> {
    return hash(password, this.rounds);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }

  /**
   * Para un login con usuario inexistente o deshabilitado (spec 002 RNF-4):
   * hace el mismo trabajo que una verificación real (contra un hash de una
   * contraseña al azar, con el mismo costo) y siempre da `false`. Así el
   * tiempo de respuesta no delata si la cuenta existe.
   */
  async verifyAgainstReference(password: string): Promise<false> {
    this.referenceHash ??= hash(randomBytes(32).toString('hex'), this.rounds);
    await compare(password, await this.referenceHash);
    return false;
  }

  /**
   * Costo leído del hash de referencia ya creado (para comprobar que iguala al
   * de los hash reales); `undefined` si todavía no se usó.
   */
  async referenceCost(): Promise<number | undefined> {
    return this.referenceHash === undefined
      ? undefined
      : getRounds(await this.referenceHash);
  }
}
