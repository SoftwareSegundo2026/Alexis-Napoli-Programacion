import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_SKIP = 0;
export const DEFAULT_LIMIT = 100;
export const MAX_LIMIT = 100;

/**
 * Convierte a número solo los textos que son enteros escritos "en limpio"
 * (`"10"`, `"-1"`). Cualquier otra cosa (`"abc"`, `"1.5"`, `""`, `"1e2"`)
 * queda como está y la rechaza `@IsInt()` con un 400 que nombra el campo.
 */
function toStrictInteger({ value }: TransformFnParams): unknown {
  return typeof value === 'string' && /^-?\d+$/.test(value)
    ? Number(value)
    : value;
}

/** Paginación de los listados: `?skip=&limit=` (RF-2, RF-10). */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    default: DEFAULT_SKIP,
    description: 'Cantidad de elementos a omitir',
  })
  @Transform(toStrictInteger)
  @IsInt()
  @Min(0)
  skip: number = DEFAULT_SKIP;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    description: 'Máximo de elementos a devolver',
  })
  @Transform(toStrictInteger)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
