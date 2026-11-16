import { ApiProperty } from '@nestjs/swagger';
import { User } from '../entities/user.entity.js';

/**
 * Usuario tal como lo expone la API (campos del servicio original). Nunca la
 * contraseña ni su hash (spec 002 RNF-1, principio 5 de la constitution).
 */
export class UserResponseDto {
  @ApiProperty({ example: 1 })
  user_id: number;

  @ApiProperty({ example: 'admin' })
  username: string;

  @ApiProperty({ example: 'admin@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true })
  full_name: string | null;

  @ApiProperty()
  disabled: boolean;

  @ApiProperty({ description: 'true → rol admin; false → rol viewer' })
  is_admin: boolean;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.user_id = user.id;
    dto.username = user.username;
    dto.email = user.email;
    dto.full_name = user.fullName;
    dto.disabled = user.disabled;
    dto.is_admin = user.isAdmin;
    return dto;
  }
}
