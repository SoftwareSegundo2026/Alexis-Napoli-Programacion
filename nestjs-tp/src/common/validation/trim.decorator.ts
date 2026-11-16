import { Transform, type TransformFnParams } from 'class-transformer';

/**
 * Recorta los espacios de los extremos de un texto ANTES de validarlo.
 * Así "   " llega vacío y falla `@IsNotEmpty()`, y lo que se guarda no tiene
 * espacios sobrantes (tabla de reglas de la spec, fila "Todos").
 * Si el valor no es texto lo deja igual: el error lo informa `@IsString()`.
 */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  );
}
