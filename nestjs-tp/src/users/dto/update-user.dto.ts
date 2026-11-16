import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { IfPresent } from '../../common/validation/if-present.decorator.js';

/**
 * Cuerpo de `PATCH /users/{id}` (spec 002 RF-11): solo estado y rol, ambos
 * opcionales pero nunca `null`. Cualquier otro campo (password, username…) → 400.
 */
export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'true deshabilita; corta el acceso en el acto',
  })
  @IfPresent()
  @IsBoolean()
  disabled?: boolean;

  @ApiPropertyOptional({ description: 'true → admin; false → viewer' })
  @IfPresent()
  @IsBoolean()
  is_admin?: boolean;
}
