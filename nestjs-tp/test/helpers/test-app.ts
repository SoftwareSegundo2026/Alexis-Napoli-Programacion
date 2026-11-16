import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';

/**
 * Levanta la aplicación completa para un archivo e2e, sobre la base temporal
 * que preparó `test/setup-e2e.ts`.
 */
export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  await app.init();
  return app;
}
