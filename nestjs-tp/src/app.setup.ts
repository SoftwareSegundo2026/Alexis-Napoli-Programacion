import { INestApplication, RequestMethod } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  BodyParseErrorInterceptor,
  deferJsonSyntaxError,
} from './auth/interceptors/body-parse-error.interceptor.js';
import { DetailExceptionFilter } from './common/filters/detail-exception.filter.js';
import { createRequestContextMiddleware } from './observability/request-context.js';
import { BEARER_SCHEME } from './common/swagger/api-docs.decorators.js';
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
  // Spec 007: requestId y log por pedido. Va PRIMERO: la duración incluye la
  // lectura del cuerpo y todo lo que sigue (lector de JSON, guards, servicios,
  // filtro de errores) corre dentro del contexto del pedido. Que el lector de
  // JSON no pierde el contexto lo cubre `observability.e2e` (caso 4: POST con
  // cuerpo que termina en 500, cuyo error sale con el requestId).
  app.use(createRequestContextMiddleware());
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
 * Documentación interactiva generada desde las rutas reales (spec 001 RF-14,
 * spec 002 RF-13): Swagger UI en `/docs` y el documento OpenAPI en `/docs-json`.
 */
function setupDocs(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Catálogo Chinook')
    .setDescription(
      'Artistas, álbumes, géneros y pistas. Las lecturas del catálogo son ' +
        'libres. Para lo demás: obtené una credencial con POST /api/v1/auth/token ' +
        'y enviala como "Authorization: Bearer <credencial>" (botón Authorize). ' +
        'Altas, modificaciones y bajas, y la administración de usuarios, exigen rol admin.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Credencial devuelta por POST /api/v1/auth/token',
      },
      BEARER_SCHEME,
    )
    .build();

  SwaggerModule.setup(DOCS_PATH, app, () =>
    SwaggerModule.createDocument(app, config),
  );
}
