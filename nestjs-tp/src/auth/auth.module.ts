import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // HS256 fijo al firmar y al verificar: se rechaza cualquier otro
        // algoritmo, incluido "none" (credencial sin firma).
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.getOrThrow<number>('JWT_EXPIRES_MINUTES') * 60,
        },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  // Los guards se registran como globales (APP_GUARD) en la tarea 002-T4.
  providers: [AuthService, AuthenticationGuard, RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}
