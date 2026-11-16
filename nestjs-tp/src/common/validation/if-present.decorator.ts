import { ValidateIf } from 'class-validator';

/**
 * Para los campos OBLIGATORIOS en una modificación parcial (PATCH):
 * si el campo no viene, no se valida (se conserva el valor actual);
 * si viene, se valida entero, incluido `null` (spec: "un campo obligatorio no
 * puede enviarse en null en una modificación").
 *
 * No se usa `@IsOptional()` porque ese decorador también deja pasar `null`, y
 * eso terminaría en un error de la base (columna NOT NULL) o en un dato vacío.
 */
export function IfPresent(): PropertyDecorator {
  return ValidateIf((_object: object, value: unknown) => value !== undefined);
}
