import { toPage } from './page.dto.js';

describe('toPage (spec 003 RF-6, RNF-6)', () => {
  it('con más resultados después de esta página → hasMore true', () => {
    expect(toPage(['a', 'b'], 5, 0, 2)).toEqual({
      items: ['a', 'b'],
      total: 5,
      skip: 0,
      limit: 2,
      hasMore: true,
    });
  });

  it('sin resultados → items vacío, total 0, hasMore false (caso 1)', () => {
    expect(toPage([], 0, 0, 100)).toEqual({
      items: [],
      total: 0,
      skip: 0,
      limit: 100,
      hasMore: false,
    });
  });

  it('skip mayor que el total → items vacío y hasMore false (caso 2)', () => {
    expect(toPage([], 10, 20, 5)).toMatchObject({
      items: [],
      total: 10,
      hasMore: false,
    });
  });

  it('la última página justa (skip + items = total) → hasMore false', () => {
    expect(toPage(['c', 'd'], 4, 2, 2).hasMore).toBe(false);
  });
});
