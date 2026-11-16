import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';

/** Datos de un usuario nuevo (sin id: lo asigna la base). */
export interface NewUser {
  username: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  hashedPassword: string;
}

/**
 * La base rechazó un alta por su índice único. Es la red de seguridad del
 * chequeo de duplicados del service (spec 002 RF-9): el service la traduce a 409.
 */
export class DuplicateUserError extends Error {
  constructor(readonly field: 'username' | 'email') {
    super(`Duplicate ${field}`);
  }
}

/** DAO de usuarios: el único lugar que habla con la tabla `User`. */
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** Una página ordenada por id, resuelta por la base (spec 002 RF-8). */
  findPage(skip: number, limit: number): Promise<User[]> {
    return this.users.find({ skip, take: limit, order: { id: 'ASC' } });
  }

  findById(id: number): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  /** Búsqueda sin distinguir mayúsculas ni espacios de los extremos (RF-1). */
  findByUsername(username: string): Promise<User | null> {
    return this.byUsername(username).getOne();
  }

  /** Igual que `findByUsername`, pero carga el hash: SOLO para el login. */
  findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.byUsername(username).addSelect('user.hashedPassword').getOne();
  }

  usernameExists(username: string): Promise<boolean> {
    return this.byUsername(username).getExists();
  }

  emailExists(email: string): Promise<boolean> {
    return this.users
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.email)) = LOWER(:email)', { email: email.trim() })
      .getExists();
  }

  /** Guarda y devuelve el usuario releído (sin el hash). */
  async create(data: NewUser): Promise<User> {
    try {
      const saved = await this.users.save(this.users.create(data));
      return await this.users.findOneByOrFail({ id: saved.id });
    } catch (error) {
      throw toDuplicateUserError(error) ?? error;
    }
  }

  /** Cambia solo estado y/o rol (spec 002 RF-11) y devuelve el usuario releído. */
  async update(
    id: number,
    changes: Partial<Pick<User, 'disabled' | 'isAdmin'>>,
  ): Promise<User> {
    await this.users.update({ id }, changes);
    return this.users.findOneByOrFail({ id });
  }

  private byUsername(username: string) {
    return this.users
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.username)) = LOWER(:username)', {
        username: username.trim(),
      });
  }
}

/** Traduce la violación del índice único de SQLite al error de dominio. */
function toDuplicateUserError(error: unknown): DuplicateUserError | undefined {
  if (!(error instanceof QueryFailedError)) {
    return undefined;
  }
  const message = error.message;
  if (!message.includes('UNIQUE constraint failed')) {
    return undefined;
  }
  return new DuplicateUserError(
    message.includes('User.Email') ? 'email' : 'username',
  );
}
