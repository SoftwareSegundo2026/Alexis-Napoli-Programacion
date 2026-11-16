import {
  DEFAULT_DATABASE_PATH,
  DEFAULT_PORT,
  validateEnv,
} from './env.validation.js';

describe('validateEnv (RNF-3)', () => {
  it('falla con un mensaje claro si falta WRITE_API_KEY', () => {
    expect(() => validateEnv({})).toThrow(/WRITE_API_KEY/);
  });

  it('falla si WRITE_API_KEY está vacía o tiene solo espacios', () => {
    expect(() => validateEnv({ WRITE_API_KEY: '' })).toThrow(/WRITE_API_KEY/);
    expect(() => validateEnv({ WRITE_API_KEY: '   ' })).toThrow(
      /WRITE_API_KEY/,
    );
  });

  it('con la clave usa los valores por defecto para la base y el puerto', () => {
    expect(validateEnv({ WRITE_API_KEY: 'clave-secreta' })).toEqual({
      WRITE_API_KEY: 'clave-secreta',
      DATABASE_PATH: DEFAULT_DATABASE_PATH,
      PORT: DEFAULT_PORT,
    });
  });

  it('respeta DATABASE_PATH y PORT cuando vienen definidos', () => {
    expect(
      validateEnv({
        WRITE_API_KEY: ' clave-secreta ',
        DATABASE_PATH: '/tmp/otra.db',
        PORT: '3300',
      }),
    ).toEqual({
      WRITE_API_KEY: 'clave-secreta',
      DATABASE_PATH: '/tmp/otra.db',
      PORT: 3300,
    });
  });

  it.each(['abc', '0', '-1', '70000', '3.5'])(
    'falla si PORT no es un puerto válido (%s)',
    (port) => {
      expect(() => validateEnv({ WRITE_API_KEY: 'clave', PORT: port })).toThrow(
        /PORT/,
      );
    },
  );

  it('no devuelve otras variables: esas se siguen leyendo de process.env', () => {
    const result = validateEnv({ WRITE_API_KEY: 'clave', OTRA: 'valor' });
    expect(Object.keys(result).sort()).toEqual([
      'DATABASE_PATH',
      'PORT',
      'WRITE_API_KEY',
    ]);
  });
});
