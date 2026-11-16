import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/**
 * Levanta la aplicación completa para un archivo e2e, sobre la base temporal
 * que preparó `test/setup-e2e.ts`, con la MISMA configuración global que
 * `main.ts` (prefijo, validación y filtro de errores).
 */
export async function createTestApp(
  // Permite reemplazar providers (p. ej. el medio de pago o el reloj, spec 004).
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<INestApplication<App>> {
  const moduleFixture = await customize(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}
