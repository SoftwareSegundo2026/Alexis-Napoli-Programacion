import { Injectable } from '@nestjs/common';

/**
 * Candado FIFO en memoria para las transacciones de reservas (spec 004, plan).
 *
 * Por qué hace falta: con better-sqlite3, TypeORM usa UNA sola conexión para
 * todos los pedidos, y una transacción que se abre mientras otra sigue abierta
 * se convierte en un SAVEPOINT dentro de la primera. Sin este candado, dos
 * reservas simultáneas quedarían mezcladas en la misma transacción (el rollback
 * de una arrastraría a la otra) y las dos podrían leer la disponibilidad antes de
 * que la otra escribiera (sobreventa). Con él, entran de a una.
 *
 * Alcanza porque la app es un solo proceso con una sola conexión; con varias
 * instancias haría falta un bloqueo en la base (fuera de alcance).
 */
@Injectable()
export class TransactionLock {
  private tail: Promise<unknown> = Promise.resolve();
  private count = 0;

  /**
   * Tareas corriendo o esperando su turno. Lo usan los tests de concurrencia para
   * saber, sin esperar un tiempo fijo, que un pedido ya está en la cola.
   */
  get pending(): number {
    return this.count;
  }

  /** Corre `task` cuando terminan todas las anteriores; su error no traba a las siguientes. */
  run<T>(task: () => Promise<T>): Promise<T> {
    this.count += 1;
    const result = this.tail.then(task, task).finally(() => {
      this.count -= 1;
    });
    this.tail = result.catch(() => undefined);
    return result;
  }
}
