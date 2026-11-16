import { INestApplication, RequestMethod } from '@nestjs/common';
import { DetailExceptionFilter } from './common/filters/detail-exception.filter.js';
import { RequestValidationPipe } from './common/validation/request-validation.pipe.js';

export const API_PREFIX = 'api/v1';

/**
 * Configuración global de la aplicación. La usan `main.ts` y los tests e2e,
 * así lo que se prueba es exactamente lo que corre en producción.
 * Se llama ANTES de `app.init()` / `app.listen()`.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  // Contrato: todas las rutas bajo /api/v1. `GET /` (saludo de la base) queda afuera.
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(new RequestValidationPipe());
  app.useGlobalFilters(new DetailExceptionFilter());
  return app;
}
