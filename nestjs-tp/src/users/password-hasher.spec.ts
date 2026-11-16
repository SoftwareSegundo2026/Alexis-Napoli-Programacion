import { ConfigService } from '@nestjs/config';
import { PasswordHasher } from './password-hasher.js';

/** Hash `$2b$` de "contraseña-de-prueba" (costo 4), con el formato que usa la base. */
const EXISTING_HASH =
  '$2b$04$lsgVue.LgjmDyvYrwR9EG.5sYBgfeZL210G.Oqi3LzEHLTw8So7c6';

function createHasher(rounds = 4): PasswordHasher {
  const config = { getOrThrow: () => rounds } as unknown as ConfigService;
  return new PasswordHasher(config);
}

describe('PasswordHasher (spec 002 RF-9, RNF-4)', () => {
  const hasher = createHasher();

  it('el hash no contiene la contraseña y usa el costo configurado', async () => {
    const hash = await hasher.hash('contraseña-secreta');

    expect(hash).not.toContain('contraseña-secreta');
    expect(hash.startsWith('$2b$04$')).toBe(true);
  });

  it('usa sal: dos hash de la misma contraseña son distintos', async () => {
    const first = await hasher.hash('misma-clave');
    const second = await hasher.hash('misma-clave');

    expect(first).not.toBe(second);
  });

  it('verifica la contraseña correcta y rechaza una incorrecta', async () => {
    const hash = await hasher.hash('correcta-123');

    await expect(hasher.verify('correcta-123', hash)).resolves.toBe(true);
    await expect(hasher.verify('incorrecta-123', hash)).resolves.toBe(false);
    await expect(hasher.verify('Correcta-123', hash)).resolves.toBe(false);
  });

  it('lee los hash $2b$ que ya trae la base', async () => {
    await expect(
      hasher.verify('contraseña-de-prueba', EXISTING_HASH),
    ).resolves.toBe(true);
  });

  it('verificar contra la referencia siempre da false (y no falla)', async () => {
    await expect(hasher.verifyAgainstReference('lo-que-sea')).resolves.toBe(
      false,
    );
    await expect(hasher.verifyAgainstReference('')).resolves.toBe(false);
  });

  it('la referencia se arma con el mismo costo que los hash reales (RNF-4)', async () => {
    const slowHasher = createHasher(6);

    await expect(slowHasher.referenceCost()).resolves.toBeUndefined();
    await slowHasher.verifyAgainstReference('x');

    await expect(slowHasher.referenceCost()).resolves.toBe(6);
  });
});
