import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/**
 * Cuerpo de `POST /auth/token` (spec 002 RF-1, RF-2). Solo se exige que sean
 * textos: un texto vacío o una combinación inexistente es una credencial
 * incorrecta (401 genérico), no un error de formato (400).
 */
export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'contraseña' })
  @IsString()
  password: string;
}
