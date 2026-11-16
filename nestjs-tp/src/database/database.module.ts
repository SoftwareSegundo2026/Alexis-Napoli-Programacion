import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import { fileURLToPath } from 'node:url';
import { Clock } from './clock.js';
import { prepareConnection } from './prepare-connection.js';
import { prepareDatabase } from './prepare-database.js';
import { TransactionLock } from './transaction-lock.js';

/**
 * Copia versionada de la Chinook del docente. Se resuelve relativa a este
 * archivo (no al directorio de trabajo): desde `src/database/` y desde
 * `dist/database/` la carpeta `data/` queda dos niveles arriba.
 */
export const TEMPLATE_DATABASE_PATH = fileURLToPath(
  new URL('../../data/chinook.template.db', import.meta.url),
);

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): TypeOrmModuleOptions => {
        const database = config.getOrThrow<string>('DATABASE_PATH');
        prepareDatabase(database, TEMPLATE_DATABASE_PATH);

        return {
          type: 'better-sqlite3',
          database,
          // La base ya existe: el servicio no debe alterar su esquema.
          synchronize: false,
          // Cada módulo registra sus entidades con TypeOrmModule.forFeature.
          autoLoadEntities: true,
          // Es un archivo local: reintentar no arregla nada y solo demora el error.
          retryAttempts: 0,
          // En cada conexión que se abre: funciones SQL propias (unicode_lower)
          // y la migración en código de la spec 004 (tablas de reservas).
          prepareDatabase: prepareConnection,
        };
      },
    }),
  ],
  // Global: el candado de transacciones y el reloj son únicos para toda la app.
  providers: [TransactionLock, Clock],
  exports: [TransactionLock, Clock],
})
@Global()
export class DatabaseModule {}
