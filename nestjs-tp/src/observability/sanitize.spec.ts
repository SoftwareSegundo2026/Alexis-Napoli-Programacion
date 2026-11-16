import { REDACTED, sanitize, sanitizeValue } from './sanitize.js';

/** Credencial con forma de JWT (no es una credencial real). */
const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwibmFtZSI6InRlc3QifQ.c2lnbmF0dXJhLWZhbHNh';

/** Saneo de lo que se escribe en los logs (spec 007 RF-14, caso 4). */
describe('sanitize', () => {
  it('tapa la credencial de un header Bearer', () => {
    const text = sanitize(`Authorization: Bearer ${JWT}`);
    expect(text).not.toContain(JWT);
    expect(text).toContain(REDACTED);
  });

  it('tapa un JWT suelto en cualquier parte del texto', () => {
    expect(sanitize(`credencial ${JWT} rechazada`)).toBe(
      `credencial ${REDACTED} rechazada`,
    );
  });

  it.each([
    ['password=hunter2', 'hunter2'],
    ['token: abc123', 'abc123'],
    ['JWT_SECRET=un-secreto-largo', 'un-secreto-largo'],
    ['{"password":"hunter2","username":"ana"}', 'hunter2'],
    ["{'newPassword': 'otra-clave'}", 'otra-clave'],
    ['dni=30123456', '30123456'],
    ['access_token=xyz&skip=0', 'xyz'],
  ])('tapa el valor de un campo sensible: %s', (text, secret) => {
    const result = sanitize(text);
    expect(result).not.toContain(secret);
    expect(result).toContain(REDACTED);
  });

  it('el JSON saneado sigue siendo JSON válido y conserva lo no sensible', () => {
    const result = sanitize('{"password":"hunter2","username":"ana"}');
    expect(JSON.parse(result)).toEqual({ password: REDACTED, username: 'ana' });
  });

  it('no toca un texto sin datos sensibles', () => {
    const text = 'GET /api/v1/artists/5 404 en 3 ms';
    expect(sanitize(text)).toBe(text);
  });
});

describe('sanitizeValue', () => {
  it('tapa por NOMBRE de campo, en cualquier nivel, y sanea los textos', () => {
    expect(
      sanitizeValue({
        username: 'ana',
        password: 'hunter2',
        nested: { Authorization: `Bearer ${JWT}`, note: `token=${JWT}` },
        list: [{ dni: 30123456 }],
      }),
    ).toEqual({
      username: 'ana',
      password: REDACTED,
      nested: { Authorization: REDACTED, note: `token=${REDACTED}` },
      list: [{ dni: REDACTED }],
    });
  });

  it('deja números, booleanos y null como están', () => {
    expect(sanitizeValue({ statusCode: 500, ok: false, value: null })).toEqual({
      statusCode: 500,
      ok: false,
      value: null,
    });
  });
});
