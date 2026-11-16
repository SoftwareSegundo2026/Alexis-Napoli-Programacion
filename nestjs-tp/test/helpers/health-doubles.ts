import type { TestingModuleBuilder } from '@nestjs/testing';
import { DatabaseProbe } from '../../src/health/database-probe.js';

/**
 * Chequeo de la base CONTROLABLE (spec 007): el contrato lo usa para pedir el
 * 503 de `/health` sin romper la base que comparten los demás casos. El 503
 * con la conexión real cerrada se prueba aparte, en `health.e2e-spec.ts`.
 */
export class ControllableDatabaseProbe {
  up = true;

  isUp(): Promise<boolean> {
    return Promise.resolve(this.up);
  }
}

/** Reemplaza el chequeo de la base de la app por el doble del test. */
export function withDatabaseProbe(
  probe: ControllableDatabaseProbe,
): (builder: TestingModuleBuilder) => TestingModuleBuilder {
  return (builder) => builder.overrideProvider(DatabaseProbe).useValue(probe);
}
