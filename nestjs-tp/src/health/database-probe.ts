import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Consulta que LEE el archivo de la base (spec 007 RF-5). `SELECT 1` no
 * alcanza: SQLite la resuelve sin tocar el archivo, así que respondería "arriba"
 * con la base dañada. `sqlite_master` es el catálogo del esquema, guardado en
 * el propio archivo.
 */
export const HEALTH_QUERY = 'SELECT COUNT(*) AS total FROM sqlite_master';

/** ¿Responde la base? Proveedor propio para que los tests puedan reemplazarlo. */
@Injectable()
export class DatabaseProbe {
  private readonly logger = new Logger(DatabaseProbe.name);

  constructor(private readonly dataSource: DataSource) {}

  async isUp(): Promise<boolean> {
    try {
      await this.dataSource.query(HEALTH_QUERY);
      return true;
    } catch (error) {
      // Al cliente solo le llega "down"; el motivo queda en el log (con requestId).
      this.logger.error(error);
      return false;
    }
  }
}
