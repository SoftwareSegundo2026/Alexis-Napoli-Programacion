import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { PasswordHasher } from './password-hasher.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repository.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersRepository, PasswordHasher, UsersService],
  // La autenticación (spec 002) busca usuarios y verifica contraseñas con esto.
  exports: [UsersRepository, PasswordHasher],
})
export class UsersModule {}
