import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../common/validation/trim.decorator.js';

/**
 * Cuerpo de `POST /users` (spec 002 RF-9, RF-10 y su tabla de reglas).
 * Nombres en snake_case, como el servicio original.
 */
export class CreateUserDto {
  @ApiProperty({ minLength: 3, maxLength: 80, example: 'ana.perez' })
  @Trim()
  @IsString()
  @Length(3, 80)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'username can only contain letters, numbers, ".", "_" and "-"',
  })
  username: string;

  @ApiProperty({ maxLength: 120, example: 'ana@example.com' })
  @Trim()
  @IsEmail()
  @MaxLength(120)
  email: string;

  /**
   * NO se recorta: la contraseña se compara exacta en el login (RF-1).
   * Máximo 72: bcrypt ignora lo que pasa de 72 bytes.
   */
  @ApiProperty({ minLength: 8, maxLength: 72, writeOnly: true })
  @IsString()
  @Length(8, 72)
  password: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 120 })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  full_name?: string | null;

  @ApiPropertyOptional({ default: false, description: 'true → rol admin' })
  @IsOptional()
  @IsBoolean()
  is_admin?: boolean;
}
