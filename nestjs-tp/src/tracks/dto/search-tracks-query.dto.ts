import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaginationQueryDto,
  toStrictInteger,
} from '../../common/dto/pagination-query.dto.js';
import { IsNotLessThan } from '../../common/validation/is-not-less-than.decorator.js';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Campos por los que se puede ordenar (whitelist, spec 003 RF-5). */
export const TRACK_SORT_FIELDS = [
  'trackId',
  'name',
  'unitPrice',
  'milliseconds',
] as const;
export type TrackSortField = (typeof TRACK_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Convierte a número solo los precios escritos "en limpio": `123` o `123.45`
 * (spec 003, tabla de parámetros). `1,5`, `1e2`, `.5` o `+1` quedan como texto
 * y los rechaza `@IsNumber()` con un 400 que nombra el parámetro.
 */
export function toStrictDecimal({ value }: TransformFnParams): unknown {
  return typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value)
    ? Number(value)
    : value;
}

/**
 * Query de `GET /tracks/search` (spec 003). Hereda `skip` y `limit` con las
 * mismas reglas de los listados. Todo se valida acá, antes del repository (RF-9);
 * un parámetro repetido llega como lista y falla su regla de tipo (caso 18).
 */
export class SearchTracksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    minLength: 1,
    maxLength: 100,
    description:
      'Texto contenido en el nombre o el compositor (sin distinguir mayúsculas; los acentos distinguen)',
  })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    description: 'Id de género',
  })
  @IsOptional()
  @Transform(toStrictInteger)
  @IsInt()
  @Min(1)
  genreId?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    description: 'Id de artista (del álbum de la pista)',
  })
  @IsOptional()
  @Transform(toStrictInteger)
  @IsInt()
  @Min(1)
  artistId?: number;

  @ApiPropertyOptional({
    minimum: 0,
    example: 0.99,
    description: 'Precio mínimo, incluido (`123` o `123.45`)',
  })
  @IsOptional()
  @Transform(toStrictDecimal)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    minimum: 0,
    example: 1.99,
    description: 'Precio máximo, incluido; no menor que minPrice',
  })
  @IsOptional()
  @Transform(toStrictDecimal)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @IsNotLessThan('minPrice')
  maxPrice?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    description: 'Duración mínima en milisegundos, incluida',
  })
  @IsOptional()
  @Transform(toStrictInteger)
  @IsInt()
  @Min(0)
  minMs?: number;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 0,
    description:
      'Duración máxima en milisegundos, incluida; no menor que minMs',
  })
  @IsOptional()
  @Transform(toStrictInteger)
  @IsInt()
  @Min(0)
  @IsNotLessThan('minMs')
  maxMs?: number;

  @ApiPropertyOptional({
    enum: TRACK_SORT_FIELDS,
    default: 'trackId',
    description: 'Campo de orden; a igualdad, desempata TrackId ascendente',
  })
  @IsOptional()
  @IsIn(TRACK_SORT_FIELDS)
  sort: TrackSortField = 'trackId';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  order: SortOrder = 'asc';
}
