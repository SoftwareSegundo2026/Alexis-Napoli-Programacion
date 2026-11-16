import { fileURLToPath } from 'node:url';

/**
 * Constantes del entorno de los tests e2e.
 *
 * Este archivo NO importa la aplicación a propósito: lo usa `test/setup-e2e.ts`,
 * que tiene que definir las variables de entorno antes de que se importe
 * `AppModule` (ConfigModule las valida en el momento de importarse).
 */

/** Clave de escritura con la que corren los tests e2e. */
export const TEST_WRITE_KEY = 'clave-de-prueba-e2e';

/** Base plantilla versionada: los tests la copian, nunca la abren. */
export const TEMPLATE_DATABASE_PATH = fileURLToPath(
  new URL('../../data/chinook.template.db', import.meta.url),
);
