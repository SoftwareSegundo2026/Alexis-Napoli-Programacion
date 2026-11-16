import { ValidationError } from 'class-validator';

const FALLBACK_MESSAGE = 'Invalid request';

/**
 * Primer mensaje de error de validación (RF-9: un solo `detail` que nombra el
 * campo). class-validator arma un árbol de errores; se recorre en orden y se
 * devuelve la primera regla incumplida que encuentre.
 */
export function firstValidationMessage(errors: ValidationError[]): string {
  for (const error of errors) {
    const ownMessage = Object.values(error.constraints ?? {})[0];
    if (ownMessage !== undefined) {
      return ownMessage;
    }
    const nestedMessage = firstValidationMessage(error.children ?? []);
    if (nestedMessage !== FALLBACK_MESSAGE) {
      return nestedMessage;
    }
  }
  return FALLBACK_MESSAGE;
}
