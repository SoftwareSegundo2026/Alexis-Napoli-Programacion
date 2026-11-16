import { INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DetailExceptionFilter } from './common/filters/detail-exception.filter.js';
import { createWriteKeyMiddleware } from './common/middleware/write-key.middleware.js';
import { RequestValidationPipe } from './common/validation/request-validation.pipe.js';

export const API_PREFIX = 'api/v1';

/**
 * Configuración global de la aplicación. La usan `main.ts` y los tests e2e,
 * así lo que se prueba es exactamente lo que corre en producción.
 * Se llama ANTES de `app.init()` / `app.listen()`.
 */
export function configureApp<T extends INestApplication>(app: T): T {
  // Primero de todo (RF-11): Nest agrega el lector del cuerpo recién en init(),
  // así que lo registrado acá con app.use() corre antes que él.
  const writeKey = app.get(ConfigService).getOrThrow<string>('WRITE_API_KEY');
  app.use(createWriteKeyMiddleware(writeKey));

  // Contrato: todas las rutas bajo /api/v1. `GET /` (saludo de la base) queda afuera.
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(new RequestValidationPipe());
  app.useGlobalFilters(new DetailExceptionFilter());
  return app;
}
