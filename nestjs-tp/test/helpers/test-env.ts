import { fileURLToPath } from 'node:url';

/**
 * Constantes del entorno de los tests e2e.
 *
 * Este archivo NO importa la aplicación a propósito: lo usa `test/setup-e2e.ts`,
 * que tiene que definir las variables de entorno antes de que se importe
 * `AppModule` (ConfigModule las valida en el momento de importarse).
 */

/**
 * Secreto de firma de los tests e2e. NO es un secreto real (spec 002, RNF-3):
 * solo firma credenciales de usuarios de prueba sobre una base descartable.
 */
export const TEST_JWT_SECRET = 'secreto-de-prueba-e2e-no-usar-en-produccion';

/** Costo de hash mínimo en los tests: con 12 la suite tardaría minutos. */
export const TEST_PASSWORD_HASH_ROUNDS = '4';

/** Base plantilla versionada: los tests la copian, nunca la abren. */
export const TEMPLATE_DATABASE_PATH = fileURLToPath(
  new URL('../../data/chinook.template.db', import.meta.url),
);
