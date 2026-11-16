import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Declara una ruta (o un controller entero) como pública: el guard de
 * autenticación la deja pasar y la credencial, si viene, se ignora (spec 002
 * RF-5). Todo lo que NO lleva este decorador exige credencial.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);
