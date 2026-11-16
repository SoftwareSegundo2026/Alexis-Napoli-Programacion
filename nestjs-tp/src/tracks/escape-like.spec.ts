import { escapeLike } from './escape-like.js';

describe('escapeLike (spec 003 RF-8)', () => {
  it.each([
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['c:\\temp', 'c:\\\\temp'],
    ['50%_off\\', '50\\%\\_off\\\\'],
  ])('%j → %j (los comodines se buscan literalmente)', (input, expected) => {
    expect(escapeLike(input)).toBe(expected);
  });

  it('un texto sin comodines queda igual (incluidas comillas y acentos)', () => {
    expect(escapeLike("O'Neil Ñandú")).toBe("O'Neil Ñandú");
  });
});
