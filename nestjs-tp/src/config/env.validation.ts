/** Variables de entorno que la aplicación valida al arrancar. */
export interface EnvironmentVariables {
  /** Clave que exigen las operaciones de escritura (RF-11). Obligatoria. */
  WRITE_API_KEY: string;
  /** Ruta de la base de trabajo; si no existe se crea desde el template. */
  DATABASE_PATH: string;
  PORT: number;
}

export const DEFAULT_DATABASE_PATH = 'data/chinook.db';
export const DEFAULT_PORT = 3000;

/**
 * Se pasa a `ConfigModule.forRoot({ validate })`. Si lanza, la aplicación no
 * arranca (RNF-3): es preferible fallar al inicio con un mensaje claro que
 * arrancar con las escrituras desprotegidas.
 *
 * Devuelve solo las variables que valida; el resto se sigue leyendo de
 * `process.env` a través de `ConfigService`.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const writeApiKey = readText(config.WRITE_API_KEY);
  if (writeApiKey === undefined) {
    throw new Error(
      'Falta la variable de entorno WRITE_API_KEY (clave de las operaciones de escritura). ' +
        'Definila en el archivo .env (ver .env.example).',
    );
  }

  return {
    WRITE_API_KEY: writeApiKey,
    DATABASE_PATH: readText(config.DATABASE_PATH) ?? DEFAULT_DATABASE_PATH,
    PORT: parsePort(config.PORT),
  };
}

/** Texto recortado, o `undefined` si no viene o queda vacío. */
function readText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parsePort(value: unknown): number {
  const text = readText(value);
  if (text === undefined) {
    return DEFAULT_PORT;
  }
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `PORT inválido ("${text}"): tiene que ser un entero entre 1 y 65535.`,
    );
  }
  return port;
}
