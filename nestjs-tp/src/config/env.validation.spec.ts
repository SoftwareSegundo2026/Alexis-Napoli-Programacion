import {
  DEFAULT_DATABASE_PATH,
  DEFAULT_JWT_EXPIRES_MINUTES,
  DEFAULT_PASSWORD_HASH_ROUNDS,
  DEFAULT_PORT,
  MIN_JWT_SECRET_LENGTH,
  validateEnv,
} from './env.validation.js';

/** Secreto de prueba válido (32 caracteres). No es un secreto real. */
const SECRET = 's'.repeat(MIN_JWT_SECRET_LENGTH);

/** Lo mínimo obligatorio para que la configuración sea válida. */
const required = { JWT_SECRET: SECRET };

const defaults = {
  DATABASE_PATH: DEFAULT_DATABASE_PATH,
  PORT: DEFAULT_PORT,
  JWT_EXPIRES_MINUTES: DEFAULT_JWT_EXPIRES_MINUTES,
  PASSWORD_HASH_ROUNDS: DEFAULT_PASSWORD_HASH_ROUNDS,
};

describe('validateEnv (spec 001 RNF-3, spec 002 RNF-2)', () => {
  // Spec 002 RF-12: la clave fija del TP-1 ya no se exige. Los dos casos que la
  // exigían ("falta" y "vacía") se transformaron en estos dos.
  it('WRITE_API_KEY ya no es obligatoria: sin ella la app arranca (spec 002 RF-12)', () => {
    expect(() => validateEnv({ JWT_SECRET: SECRET })).not.toThrow();
    expect(() =>
      validateEnv({ JWT_SECRET: SECRET, WRITE_API_KEY: '   ' }),
    ).not.toThrow();
  });

  it('WRITE_API_KEY, si quedó en un .env viejo, se ignora y no se devuelve', () => {
    expect(
      validateEnv({ ...required, WRITE_API_KEY: 'clave-vieja' }),
    ).not.toHaveProperty('WRITE_API_KEY');
  });

  it('con lo obligatorio usa los valores por defecto para el resto', () => {
    expect(validateEnv(required)).toEqual({ JWT_SECRET: SECRET, ...defaults });
  });

  it('respeta DATABASE_PATH y PORT cuando vienen definidos', () => {
    expect(
      validateEnv({
        ...required,
        DATABASE_PATH: '/tmp/otra.db',
        PORT: '3300',
      }),
    ).toEqual({
      ...defaults,
      JWT_SECRET: SECRET,
      DATABASE_PATH: '/tmp/otra.db',
      PORT: 3300,
    });
  });

  it.each(['abc', '0', '-1', '70000', '3.5'])(
    'falla si PORT no es un puerto válido (%s)',
    (port) => {
      expect(() => validateEnv({ ...required, PORT: port })).toThrow(/PORT/);
    },
  );

  it('no devuelve otras variables: esas se siguen leyendo de process.env', () => {
    const result = validateEnv({ ...required, OTRA: 'valor' });
    expect(Object.keys(result).sort()).toEqual([
      'DATABASE_PATH',
      'JWT_EXPIRES_MINUTES',
      'JWT_SECRET',
      'PASSWORD_HASH_ROUNDS',
      'PORT',
    ]);
  });

  describe('secreto de firma de la credencial (RNF-2)', () => {
    it('falla con un mensaje claro si falta JWT_SECRET', () => {
      expect(() => validateEnv({})).toThrow(/JWT_SECRET/);
    });

    it.each(['', '   ', 'corto', 'x'.repeat(MIN_JWT_SECRET_LENGTH - 1)])(
      'falla si JWT_SECRET está vacío o tiene menos de 32 caracteres (%j)',
      (secret) => {
        expect(() => validateEnv({ ...required, JWT_SECRET: secret })).toThrow(
          /JWT_SECRET.*32/,
        );
      },
    );

    it('acepta un secreto de 32 caracteres o más', () => {
      const longSecret = 'y'.repeat(64);
      expect(
        validateEnv({ ...required, JWT_SECRET: longSecret }).JWT_SECRET,
      ).toBe(longSecret);
    });
  });

  describe('duración de la credencial (RNF-2)', () => {
    it('por defecto dura 30 minutos', () => {
      expect(validateEnv(required).JWT_EXPIRES_MINUTES).toBe(30);
    });

    it('respeta JWT_EXPIRES_MINUTES', () => {
      expect(
        validateEnv({ ...required, JWT_EXPIRES_MINUTES: '5' })
          .JWT_EXPIRES_MINUTES,
      ).toBe(5);
    });

    it.each(['0', '-5', '1.5', 'media hora'])(
      'falla si JWT_EXPIRES_MINUTES no es un entero positivo (%s)',
      (minutes) => {
        expect(() =>
          validateEnv({ ...required, JWT_EXPIRES_MINUTES: minutes }),
        ).toThrow(/JWT_EXPIRES_MINUTES/);
      },
    );
  });

  describe('costo del hash de contraseñas', () => {
    it('por defecto es 12, como los hash que ya tiene la base', () => {
      expect(validateEnv(required).PASSWORD_HASH_ROUNDS).toBe(12);
    });

    it('acepta valores entre 4 y 15', () => {
      expect(
        validateEnv({ ...required, PASSWORD_HASH_ROUNDS: '4' })
          .PASSWORD_HASH_ROUNDS,
      ).toBe(4);
      expect(
        validateEnv({ ...required, PASSWORD_HASH_ROUNDS: '15' })
          .PASSWORD_HASH_ROUNDS,
      ).toBe(15);
    });

    it.each(['3', '16', 'doce'])(
      'falla fuera de rango o si no es entero (%s)',
      (rounds) => {
        expect(() =>
          validateEnv({ ...required, PASSWORD_HASH_ROUNDS: rounds }),
        ).toThrow(/PASSWORD_HASH_ROUNDS/);
      },
    );
  });
});
