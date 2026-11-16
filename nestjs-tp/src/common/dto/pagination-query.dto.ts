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
 *
 * Un entero enorme se topa en `Number.MAX_SAFE_INTEGER` (spec 005 RF-6): sin
 * el tope, 20 dígitos llegaban a SQLite como un OFFSET mayor que 2^63 (→ 500)
 * y cientos de dígitos se volvían `Infinity` (→ 400). Ninguna tabla tiene
 * tantas filas, así que el resultado es el mismo: `[]`. En `limit`, el valor
 * topado sigue superando `@Max(100)` → 400.
 */
export function toStrictInteger({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string' || !/^-?\d+$/.test(value)) {
    return value;
  }
  return Math.min(Number(value), Number.MAX_SAFE_INTEGER);
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
