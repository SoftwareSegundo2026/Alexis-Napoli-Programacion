/** Variables de entorno que la aplicación valida al arrancar. */
export interface EnvironmentVariables {
  /** Secreto con el que se firman las credenciales (spec 002, RNF-2). Obligatorio. */
  JWT_SECRET: string;
  /** Minutos de vida de una credencial (spec 002, RNF-2). */
  JWT_EXPIRES_MINUTES: number;
  /** Costo del hash de contraseñas (rondas de bcrypt). */
  PASSWORD_HASH_ROUNDS: number;
  /** Ruta de la base de trabajo; si no existe se crea desde el template. */
  DATABASE_PATH: string;
  PORT: number;
}

export const DEFAULT_DATABASE_PATH = 'data/chinook.db';
export const DEFAULT_PORT = 3000;
export const DEFAULT_JWT_EXPIRES_MINUTES = 30;
/** Igual al costo de los hash que ya trae la base (`$2b$12$`). */
export const DEFAULT_PASSWORD_HASH_ROUNDS = 12;
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Se pasa a `ConfigModule.forRoot({ validate })`. Si lanza, la aplicación no
 * arranca: es preferible fallar al inicio con un mensaje claro que arrancar
 * sin poder firmar credenciales o con un secreto adivinable.
 *
 * Devuelve solo las variables que valida; el resto se sigue leyendo de
 * `process.env` a través de `ConfigService`. La clave fija del TP-1
 * (`WRITE_API_KEY`) ya no se usa (spec 002 RF-12): si quedó en un `.env`, se ignora.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  return {
    JWT_SECRET: readJwtSecret(config.JWT_SECRET),
    JWT_EXPIRES_MINUTES: readInteger(
      'JWT_EXPIRES_MINUTES',
      config.JWT_EXPIRES_MINUTES,
      DEFAULT_JWT_EXPIRES_MINUTES,
      { min: 1, max: Number.MAX_SAFE_INTEGER },
    ),
    PASSWORD_HASH_ROUNDS: readInteger(
      'PASSWORD_HASH_ROUNDS',
      config.PASSWORD_HASH_ROUNDS,
      DEFAULT_PASSWORD_HASH_ROUNDS,
      { min: 4, max: 15 },
    ),
    DATABASE_PATH: readText(config.DATABASE_PATH) ?? DEFAULT_DATABASE_PATH,
    PORT: readInteger('PORT', config.PORT, DEFAULT_PORT, {
      min: 1,
      max: 65535,
    }),
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

/**
 * El secreto tiene que existir y ser largo: con uno corto, cualquiera podría
 * probar secretos hasta dar con el que firma las credenciales y fabricarse una.
 */
function readJwtSecret(value: unknown): string {
  const secret = readText(value);
  if (secret === undefined || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET falta o es demasiado corto: tiene que tener al menos ${MIN_JWT_SECRET_LENGTH} ` +
        'caracteres. Definilo en el archivo .env (ver .env.example).',
    );
  }
  return secret;
}

function readInteger(
  name: string,
  value: unknown,
  defaultValue: number,
  range: { min: number; max: number },
): number {
  const text = readText(value);
  if (text === undefined) {
    return defaultValue;
  }
  const number = Number(text);
  if (!Number.isInteger(number) || number < range.min || number > range.max) {
    throw new Error(
      `${name} inválido ("${text}"): tiene que ser un entero entre ${range.min} y ${range.max}.`,
    );
  }
  return number;
}
