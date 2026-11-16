import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { SearchTracksQueryDto } from './search-tracks-query.dto.js';

/** Pasa la query por el mismo pipe global que usa la aplicación. */
function parseQuery(
  query: Record<string, string | string[]>,
): Promise<unknown> {
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: SearchTracksQueryDto,
    data: undefined,
  };
  return new RequestValidationPipe().transform(query, metadata);
}

describe('SearchTracksQueryDto (spec 003 RF-9 y tabla de parámetros)', () => {
  it('sin parámetros: todo por defecto (RF-1)', async () => {
    const result = await parseQuery({});

    expect(result).toBeInstanceOf(SearchTracksQueryDto);
    expect(result).toEqual({
      skip: 0,
      limit: 100,
      sort: 'trackId',
      order: 'asc',
    });
  });

  it('convierte y recorta todos los parámetros válidos', async () => {
    await expect(
      parseQuery({
        q: '  love  ',
        genreId: '1',
        artistId: '22',
        minPrice: '0.99',
        maxPrice: '1.99',
        minMs: '1000',
        maxMs: '300000',
        sort: 'unitPrice',
        order: 'desc',
        skip: '5',
        limit: '10',
      }),
    ).resolves.toEqual({
      q: 'love',
      genreId: 1,
      artistId: 22,
      minPrice: 0.99,
      maxPrice: 1.99,
      minMs: 1000,
      maxMs: 300000,
      sort: 'unitPrice',
      order: 'desc',
      skip: 5,
      limit: 10,
    });
  });

  it.each(['trackId', 'name', 'unitPrice', 'milliseconds'])(
    'sort=%s es válido (whitelist)',
    async (sort) => {
      await expect(parseQuery({ sort })).resolves.toMatchObject({ sort });
    },
  );

  it('mínimo igual a máximo es válido: valor exacto (caso 17)', async () => {
    await expect(
      parseQuery({
        minPrice: '0.99',
        maxPrice: '0.99',
        minMs: '5',
        maxMs: '5',
      }),
    ).resolves.toMatchObject({
      minPrice: 0.99,
      maxPrice: 0.99,
      minMs: 5,
      maxMs: 5,
    });
  });

  it('precios sin decimales y con un decimal también son válidos', async () => {
    await expect(
      parseQuery({ minPrice: '1', maxPrice: '2.5' }),
    ).resolves.toMatchObject({ minPrice: 1, maxPrice: 2.5 });
  });

  it('ignora parámetros desconocidos, como los listados', async () => {
    await expect(parseQuery({ otro: 'x' })).resolves.toEqual({
      skip: 0,
      limit: 100,
      sort: 'trackId',
      order: 'asc',
    });
  });

  // Cada regla incumplida → 400 cuyo mensaje EMPIEZA con el nombre del parámetro.
  it.each([
    ['q', ''],
    ['q', '   '], // caso 13
    ['q', 'x'.repeat(101)],
    ['genreId', '0'],
    ['genreId', 'abc'],
    ['genreId', '1.5'],
    ['artistId', '-1'],
    ['minPrice', '1,5'], // caso 20
    ['minPrice', '1e2'],
    ['minPrice', '.5'],
    ['minPrice', '+1'],
    ['minPrice', '0.999'],
    ['minPrice', '-1'],
    ['maxPrice', 'abc'],
    ['minMs', '-5'],
    ['maxMs', '1.5'],
    ['sort', 'campo_hackers'], // caso 4
    ['sort', 'Name'],
    ['order', 'arriba'],
    ['limit', '999999'], // caso 8
    ['skip', '-1'], // caso 9
    ['skip', 'abc'],
  ])('%s=%j → 400 que nombra al parámetro', async (param, value) => {
    const result = parseQuery({ [param]: value });

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow(new RegExp(`^${param} `));
  });

  it.each(['genreId', 'q', 'minPrice', 'sort'])(
    '%s repetido → 400 que lo nombra (caso 18)',
    async (param) => {
      const value = param === 'sort' ? ['name', 'unitPrice'] : ['1', '2'];
      const result = parseQuery({ [param]: value });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(new RegExp(`^${param} `));
    },
  );

  it.each([
    ['maxPrice', { minPrice: '2', maxPrice: '1' }], // caso 11
    ['maxMs', { minMs: '5', maxMs: '4' }],
  ])('mínimo mayor que máximo → 400 que nombra %s', async (param, query) => {
    const result = parseQuery(query);

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow(new RegExp(`^${param} `));
  });
});
