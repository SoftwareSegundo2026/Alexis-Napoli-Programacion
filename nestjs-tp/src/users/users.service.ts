import { ConflictException, Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { User } from './entities/user.entity.js';
import { PasswordHasher } from './password-hasher.js';
import { DuplicateUserError, UsersRepository } from './users.repository.js';

const DUPLICATE_MESSAGES = {
  username: 'Username already registered',
  email: 'Email already registered',
} as const;

/** Reglas de negocio de usuarios (spec 002 RF-8 a RF-11). */
@Injectable()
export class UsersService {
  /**
   * Cola de altas: se procesan de a una (plan 002, decisión 6). Sin esto, dos
   * altas iguales simultáneas podrían pasar las dos el chequeo de duplicado
   * antes de que alguna guarde (condición de carrera, caso 23).
   */
  private creations: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  findAll({ skip, limit }: PaginationQueryDto): Promise<User[]> {
    return this.users.findPage(skip, limit);
  }

  create(dto: CreateUserDto): Promise<User> {
    const creation = this.creations.then(() => this.createNow(dto));
    // La siguiente alta espera a esta, haya salido bien o mal.
    this.creations = creation.catch(() => undefined);
    return creation;
  }

  private async createNow(dto: CreateUserDto): Promise<User> {
    if (await this.users.usernameExists(dto.username)) {
      throw new ConflictException(DUPLICATE_MESSAGES.username);
    }
    if (await this.users.emailExists(dto.email)) {
      throw new ConflictException(DUPLICATE_MESSAGES.email);
    }

    // Solo el hash con sal llega a la base; la contraseña no se guarda nunca.
    const hashedPassword = await this.hasher.hash(dto.password);
    try {
      return await this.users.create({
        username: dto.username,
        email: dto.email,
        fullName: dto.full_name ?? null,
        isAdmin: dto.is_admin ?? false,
        hashedPassword,
      });
    } catch (error) {
      if (error instanceof DuplicateUserError) {
        throw new ConflictException(DUPLICATE_MESSAGES[error.field]);
      }
      throw error;
    }
  }
}
