import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { RequestValidationPipe } from '../validation/request-validation.pipe.js';
import { PaginationQueryDto } from './pagination-query.dto.js';

/** Pasa la query por el mismo pipe global que usa la aplicación. */
function parseQuery(query: Record<string, string>): Promise<unknown> {
  const metadata: ArgumentMetadata = {
    type: 'query',
    metatype: PaginationQueryDto,
    data: undefined,
  };
  return new RequestValidationPipe().transform(query, metadata);
}

describe('PaginationQueryDto (RF-2, RF-10)', () => {
  it('sin parámetros usa skip=0 y limit=100', async () => {
    const result = await parseQuery({});

    expect(result).toBeInstanceOf(PaginationQueryDto);
    expect(result).toEqual({ skip: 0, limit: 100 });
  });

  it('convierte skip y limit a números', async () => {
    await expect(parseQuery({ skip: '10', limit: '5' })).resolves.toEqual({
      skip: 10,
      limit: 5,
    });
  });

  it('acepta los extremos válidos (skip=0, limit=1 y limit=100)', async () => {
    await expect(parseQuery({ skip: '0', limit: '1' })).resolves.toEqual({
      skip: 0,
      limit: 1,
    });
    await expect(parseQuery({ limit: '100' })).resolves.toEqual({
      skip: 0,
      limit: 100,
    });
  });

  it.each(['0', '101', 'abc', '1.5', '', '1e2'])(
    'limit=%j → 400 que nombra a limit',
    async (limit) => {
      const result = parseQuery({ limit });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/limit/);
    },
  );

  it.each(['-1', 'abc', '2.5'])(
    'skip=%j → 400 que nombra a skip',
    async (skip) => {
      const result = parseQuery({ skip });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/skip/);
    },
  );

  // Spec 005 RF-6 (bug 1): el tamaño de skip nunca da 400 ni 500. Un skip más
  // grande que cualquier tabla equivale a "después del final": se topa en el
  // mayor entero seguro, que SQLite entiende (por encima de 2^63 falla → 500).
  it.each([
    ['20 dígitos', '9'.repeat(20)],
    ['400 dígitos', '9'.repeat(400)],
  ])(
    'skip de %s se acepta, topado en Number.MAX_SAFE_INTEGER (RF-6)',
    async (_label, skip) => {
      await expect(parseQuery({ skip })).resolves.toEqual({
        skip: Number.MAX_SAFE_INTEGER,
        limit: 100,
      });
    },
  );

  it('un limit enorme sigue → 400 que nombra a limit (RF-6, caso 8)', async () => {
    const result = parseQuery({ skip: '9'.repeat(20), limit: '9'.repeat(20) });

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow(/limit/);
  });

  it('ignora otros parámetros de la query (como el servicio original)', async () => {
    await expect(parseQuery({ limit: '5', otro: 'x' })).resolves.toEqual({
      skip: 0,
      limit: 5,
    });
  });
});
