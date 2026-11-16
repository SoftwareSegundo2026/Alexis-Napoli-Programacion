import { INestApplication, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  BodyParseErrorInterceptor,
  deferJsonSyntaxError,
} from './auth/interceptors/body-parse-error.interceptor.js';
import { DetailExceptionFilter } from './common/filters/detail-exception.filter.js';
import { WRITE_KEY_SCHEME } from './common/swagger/api-docs.decorators.js';
import { RequestValidationPipe } from './common/validation/request-validation.pipe.js';

export const API_PREFIX = 'api/v1';

/** Ruta de la documentación interactiva; el JSON queda en `/docs-json`. */
export const DOCS_PATH = 'docs';

/**
 * Configuración global de la aplicación. La usan `main.ts` y los tests e2e,
 * así lo que se prueba es exactamente lo que corre en producción.
 * Se llama ANTES de `app.init()` / `app.listen()`.
 *
 * La autenticación y los roles NO están acá: son guards globales registrados
 * en `AuthModule` (spec 002), que leen los decoradores de cada ruta.
 */
export function configureApp<T extends NestExpressApplication>(app: T): T {
  // Lector de JSON registrado antes que el de Nest (que entonces no agrega el
  // suyo) y, justo detrás, el manejador que difiere el error de JSON malformado
  // hasta después de los guards (plan 002, decisión 2).
  app.useBodyParser('json');
  app.use(deferJsonSyntaxError);

  // Contrato: todas las rutas bajo /api/v1. `GET /` (saludo de la base) queda afuera.
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.useGlobalInterceptors(new BodyParseErrorInterceptor());
  app.useGlobalPipes(new RequestValidationPipe());
  app.useGlobalFilters(new DetailExceptionFilter());
  setupDocs(app);
  return app;
}

/**
 * Documentación interactiva generada desde las rutas reales (RF-14):
 * Swagger UI en `/docs` y el documento OpenAPI en `/docs-json`.
 * (El esquema de credencial Bearer se documenta en la tarea 002-T8.)
 */
function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Catálogo Chinook')
    .setDescription(
      'Artistas, álbumes, géneros y pistas. Las lecturas son libres; las ' +
        'altas, modificaciones y bajas exigen una credencial de administrador.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Se reemplaza por la credencial Bearer (002-T8)',
      },
      WRITE_KEY_SCHEME,
    )
    .build();

  SwaggerModule.setup(DOCS_PATH, app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
