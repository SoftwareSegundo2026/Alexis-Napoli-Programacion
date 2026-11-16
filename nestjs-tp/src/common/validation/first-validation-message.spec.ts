import { ValidationError } from 'class-validator';
import { firstValidationMessage } from './first-validation-message.js';

function validationError(partial: Partial<ValidationError>): ValidationError {
  return Object.assign(new ValidationError(), partial);
}

describe('firstValidationMessage', () => {
  it('devuelve el mensaje de la primera regla incumplida', () => {
    const errors = [
      validationError({
        property: 'Name',
        constraints: { isNotEmpty: 'Name should not be empty' },
      }),
      validationError({
        property: 'ImageUrl',
        constraints: { isString: 'ImageUrl must be a string' },
      }),
    ];

    expect(firstValidationMessage(errors)).toBe('Name should not be empty');
  });

  it('busca en los errores anidados si el primero no tiene reglas propias', () => {
    const errors = [
      validationError({
        property: 'Parent',
        children: [
          validationError({
            property: 'Child',
            constraints: { isInt: 'Child must be an integer number' },
          }),
        ],
      }),
    ];

    expect(firstValidationMessage(errors)).toBe(
      'Child must be an integer number',
    );
  });

  it('si no hay ningún mensaje devuelve uno genérico', () => {
    expect(firstValidationMessage([])).toBe('Invalid request');
  });
});
