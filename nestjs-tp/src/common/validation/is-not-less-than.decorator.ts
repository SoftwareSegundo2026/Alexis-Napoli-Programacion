import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';

/**
 * El valor no puede ser menor que el de otra propiedad del mismo objeto
 * (p. ej. `maxPrice` ≥ `minPrice`, spec 003 RF-9). Si alguno de los dos no vino
 * o no es número, no opina: de eso se encargan las otras reglas.
 */
export function IsNotLessThan(
  otherProperty: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isNotLessThan',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [otherProperty],
      options: {
        message: `$property must not be less than ${otherProperty}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other: unknown = Reflect.get(args.object, otherProperty);
          if (typeof value !== 'number' || typeof other !== 'number') {
            return true;
          }
          return value >= other;
        },
      },
    });
  };
}
