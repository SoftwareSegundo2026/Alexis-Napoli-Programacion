import { runMigrations, type SqlExecutor } from './migrations.js';
import {
  registerSqlFunctions,
  type SqlFunctionRegistry,
} from './sql-functions.js';

/**
 * Lo que se hace cada vez que se abre la conexión (`prepareDatabase` de TypeORM):
 * registrar las funciones SQL propias (spec 005) y aplicar la migración en código
 * de la spec 004. App, e2e y tests de repositories usan exactamente esto.
 */
export function prepareConnection(
  database: SqlFunctionRegistry & SqlExecutor,
): void {
  registerSqlFunctions(database);
  runMigrations(database);
}
