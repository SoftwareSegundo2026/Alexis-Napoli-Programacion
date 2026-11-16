import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
  ValidationPipe,
  type ValidationPipeOptions,
} from '@nestjs/common';
import { firstValidationMessage } from './first-validation-message.js';

const commonOptions: ValidationPipeOptions = {
  // Convierte el JSON plano en la instancia del DTO (aplica @Transform, defaults).
  transform: true,
  // Descarta lo que el DTO no declara: nunca llega al service.
  whitelist: true,
  // 400 con un único `detail` que nombra el campo (RF-9).
  exceptionFactory: (errors) =>
    new BadRequestException(firstValidationMessage(errors)),
};

/**
 * Pipe de validación global.
 *
 * - **Cuerpo**: un campo desconocido → 400 (regla "Todos" de la spec).
 * - **Query y ruta**: los parámetros desconocidos se ignoran, como en el
 *   servicio original; rechazarlos rompería clientes que hoy funcionan.
 */
@Injectable()
export class RequestValidationPipe implements PipeTransform<unknown> {
  private readonly bodyPipe = new ValidationPipe({
    ...commonOptions,
    forbidNonWhitelisted: true,
  });

  private readonly queryPipe = new ValidationPipe(commonOptions);

  transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const pipe = metadata.type === 'body' ? this.bodyPipe : this.queryPipe;
    return pipe.transform(value, metadata) as Promise<unknown>;
  }
}
