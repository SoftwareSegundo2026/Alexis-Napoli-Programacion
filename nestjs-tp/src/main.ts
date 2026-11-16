import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule, ObserveInstrument, observeEnabled } from './app.module.js';
import { configureApp } from './app.setup.js';
import { validateEnv } from './config/env.validation.js';
import { JsonLogger } from './observability/json-logger.js';
import { currentRequestId } from './observability/request-context.js';

// Al importar AppModule, `ConfigModule.forRoot` ya cargó el `.env` y lo validó:
// si una variable estaba mal, el arranque se cortó ahí nombrándola (spec 007
// RF-6). Acá se vuelve a leer solo para configurar el logger y el puerto.
const env = validateEnv(process.env);

/** Logs en JSON desde la primera línea, también los de Nest (spec 007 RF-11). */
const logger = new JsonLogger({
  level: env.LOG_LEVEL,
  write: (line) => process.stdout.write(line),
  requestId: currentRequestId,
});

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
    // Por defecto, si el arranque falla (p. ej. la base no abre), Nest llama a
    // process.abort(): el proceso muere sin explicar por qué. Así el error
    // llega hasta acá y se registra (spec 007 RF-7).
    abortOnError: false,
    // El hook de instrumentación solo tiene sentido con el módulo de Observe
    // registrado: sin ese módulo no hay agente que consuma los spans.
    instrument: observeEnabled ? ObserveInstrument : undefined,
  });
  configureApp(app);
  // Spec 007 RF-16: ante SIGTERM (redespliegue, `docker compose stop`) o SIGINT,
  // Nest deja de aceptar conexiones, espera los pedidos en curso, cierra la
  // base y sale con 0. Sin `useProcessExit`, Nest se reenvía la señal y el
  // proceso sale con 143 (como si lo hubieran matado).
  app.enableShutdownHooks(['SIGTERM', 'SIGINT'], { useProcessExit: true });

  const bootstrapLogger = new Logger('Bootstrap');
  if (!observeEnabled) {
    bootstrapLogger.log(
      'Observe desactivado: agregá OBSERVE_APP_KEY y OBSERVE_APP_SECRET en .env para enviar telemetría (https://observe.nestjs.com).',
    );
  }

  await app.listen(env.PORT);
  bootstrapLogger.log(`API escuchando en el puerto ${env.PORT}`);
}

try {
  await bootstrap();
} catch (error) {
  logger.fatal(error, 'Bootstrap');
  // Sale cuando la línea ya se escribió: no queda un proceso a medio arrancar.
  process.stdout.write('', () => process.exit(1));
}
