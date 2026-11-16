import type { ContractCase } from './contract-case.js';
import { HEALTH_DOWN, HEALTH_UP, object } from './shapes.js';

/** Chequeo de salud (spec 007 RF-5): fuera del prefijo, público. */
export const HEALTH_CASES: readonly ContractCase[] = [
  {
    operation: 'GET /health',
    status: 200,
    name: 'base arriba',
    expected: object(HEALTH_UP),
    send: async (c) => c.http().get('/health'),
  },
  {
    operation: 'GET /health',
    status: 503,
    name: 'base caída (probe de prueba)',
    expected: object(HEALTH_DOWN),
    send: async (c) => {
      c.setDatabaseUp(false);
      try {
        return await c.http().get('/health');
      } finally {
        c.setDatabaseUp(true);
      }
    },
  },
];
