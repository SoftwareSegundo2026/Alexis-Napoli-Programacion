import { INestApplication, RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DetailExceptionFilter } from './common/filters/detail-exception.filter.js';
import {
  WRITE_KEY_HEADER,
  createWriteKeyMiddleware,
} from './common/middleware/write-key.middleware.js';
import { WRITE_KEY_SCHEME } from './common/swagger/api-docs.decorators.js';
import { RequestValidationPipe } from './common/validation/request-validation.pipe.js';

export const API_PREFIX = 'api/v1';

/** Ruta de la documentación interactiva; el JSON queda en `/docs-json`. */
export const DOCS_PATH = 'docs';

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
  setupDocs(app);
  return app;
}

/**
 * Documentación interactiva generada desde las rutas reales (RF-14):
 * Swagger UI en `/docs` y el documento OpenAPI en `/docs-json`.
 */
function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Catálogo Chinook')
    .setDescription(
      'Artistas, álbumes, géneros y pistas. Las lecturas son libres; las ' +
        'altas, modificaciones y bajas exigen la clave en el header X-API-Key.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: `Clave de escritura (header ${WRITE_KEY_HEADER})`,
      },
      WRITE_KEY_SCHEME,
    )
    .build();

  SwaggerModule.setup(DOCS_PATH, app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
