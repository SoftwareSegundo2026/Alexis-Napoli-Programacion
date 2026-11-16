import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationShutdown,
} from '@nestjs/common';

/**
 * Deja constancia del apagado ordenado (spec 007 RF-16). Nest llama a estos
 * hooks en orden: `beforeApplicationShutdown` → cierra el servidor HTTP
 * (espera los pedidos en curso) → `onApplicationShutdown` (TypeORM cierra la
 * base acá). Así el log responde "¿se apagó bien o se cayó?".
 */
@Injectable()
export class ShutdownLogger
  implements BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger('Shutdown');

  beforeApplicationShutdown(signal?: string): void {
    this.logger.log(
      `Apagado ordenado (${signal ?? 'cierre de la aplicación'}): no se aceptan pedidos nuevos; se terminan los que están en curso`,
    );
  }

  onApplicationShutdown(): void {
    this.logger.log('Apagado completo: servidor y base cerrados');
  }
}
