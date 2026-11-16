import type request from 'supertest';
import type { ExpectedBody } from './shapes.js';

/** Lo que un caso necesita para armar su petición (lo provee `contract.e2e-spec.ts`). */
export interface ContractContext {
  /** Cliente HTTP contra la app de prueba. */
  http(): ReturnType<typeof request>;
  /** Agrega la credencial del admin de prueba. */
  asAdmin(test: request.Test): request.Test;
  /** Agrega la credencial del viewer de prueba (rol insuficiente → 403). */
  asViewer(test: request.Test): request.Test;
  /** Crea un recurso PROPIO del caso (para modificar o borrar sin depender de otros) y devuelve su id. */
  create(base: string, body: object): Promise<number>;
  /** Hace que el medio de pago de prueba rechace (`reject`) o apruebe los cobros (spec 004). */
  setPaymentMode(mode: 'approve' | 'reject'): void;
  /** Fija la hora del reloj de prueba (`null` = la hora real). */
  setNow(date: Date | null): void;
  /** Hace que el chequeo de la base de prueba responda arriba o caída (spec 007). */
  setDatabaseUp(up: boolean): void;
}

/**
 * Un caso del contrato: una operación documentada, un código y la forma de la
 * respuesta. `operation` usa el mismo formato que el documento OpenAPI
 * (`MÉTODO /ruta/{id}`), así el inventario (T3) puede cruzarlos.
 */
export interface ContractCase {
  readonly operation: string;
  readonly status: number;
  readonly name: string;
  readonly expected: ExpectedBody;
  send(context: ContractContext): Promise<request.Response>;
}

/** Contador para nombres únicos dentro de un archivo e2e (cada uno tiene su base). */
let counter = 0;
export function uniqueName(prefix: string): string {
  counter += 1;
  return `${prefix} contrato ${counter}`;
}

/** Variante sin espacios, para los `username` (solo letras, números, `.`, `_` y `-`). */
export function uniqueUsername(): string {
  counter += 1;
  return `contrato_${counter}`;
}
