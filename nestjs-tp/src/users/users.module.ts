import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { PasswordHasher } from './password-hasher.js';
import { UsersRepository } from './users.repository.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersRepository, PasswordHasher],
  // La autenticación (spec 002) busca usuarios y verifica contraseñas con esto.
  exports: [UsersRepository, PasswordHasher],
})
export class UsersModule {}
