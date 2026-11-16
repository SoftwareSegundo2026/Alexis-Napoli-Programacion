import { randomUUID } from 'node:crypto';
import { copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
import {
  TEMPLATE_DATABASE_PATH,
  TEST_JWT_SECRET,
  TEST_PASSWORD_HASH_ROUNDS,
} from './helpers/test-env.js';

/**
 * Corre antes de CADA archivo e2e (RNF-4):
 * - copia el template a una base temporal propia de ese archivo, fuera del repo
 *   (así dos archivos en paralelo no se pisan y la plantilla queda intacta);
 * - define las variables de entorno antes de que el archivo importe AppModule.
 *
 * Las variables de proceso tienen prioridad sobre un `.env` local, así que los
 * tests no dependen de la configuración de quien los corre.
 */
const databasePath = join(tmpdir(), `chinook-e2e-${randomUUID()}.db`);
copyFileSync(TEMPLATE_DATABASE_PATH, databasePath);

process.env.DATABASE_PATH = databasePath;
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.PASSWORD_HASH_ROUNDS = TEST_PASSWORD_HASH_ROUNDS;

// Los afterAll de los tests (que cierran la app) corren antes que este.
afterAll(() => {
  rmSync(databasePath, { force: true });
});
