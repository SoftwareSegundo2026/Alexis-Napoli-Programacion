import { Transform, type TransformFnParams } from 'class-transformer';

/**
 * Para los textos OPCIONALES: recorta los espacios de los extremos y, si no
 * queda nada, devuelve `null` (spec 005 RF-8). Así `""` o `"   "` valen lo
 * mismo que enviar `null`: "sin valor". `@IsOptional()` deja pasar ese `null`.
 *
 * No reemplaza a `@Trim()` en los obligatorios: ahí `""` tiene que seguir
 * fallando con `@IsNotEmpty()` (400 que nombra el campo).
 * Si el valor no es texto lo deja igual: el error lo informa `@IsString()`.
 */
export function TrimToNull(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams): unknown => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
}
