import { ArgumentMetadata } from '@nestjs/common';
import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { CreateAlbumDto } from './create-album.dto.js';
import { UpdateAlbumDto } from './update-album.dto.js';

function validateBody(
  metatype: ArgumentMetadata['metatype'],
  body: unknown,
): Promise<unknown> {
  return new RequestValidationPipe().transform(body, {
    type: 'body',
    metatype,
    data: undefined,
  });
}

describe('DTOs de álbumes (RF-9)', () => {
  it('alta válida con Title y ArtistId', async () => {
    await expect(
      validateBody(CreateAlbumDto, { Title: ' Nuevo ', ArtistId: 1 }),
    ).resolves.toEqual(
      expect.objectContaining({ Title: 'Nuevo', ArtistId: 1 }),
    );
  });

  it.each([
    [{ ArtistId: 1 }, /Title/],
    [{ Title: '  ', ArtistId: 1 }, /Title/],
    [{ Title: 'x'.repeat(161), ArtistId: 1 }, /Title/],
    [{ Title: 'Nuevo' }, /ArtistId/],
    [{ Title: 'Nuevo', ArtistId: '1' }, /ArtistId/],
    [{ Title: 'Nuevo', ArtistId: 1.5 }, /ArtistId/],
    [{ Title: 'Nuevo', ArtistId: 1, ImageUrl: 'x'.repeat(501) }, /ImageUrl/],
  ])('alta inválida %j → nombra el campo', async (body, field) => {
    await expect(validateBody(CreateAlbumDto, body)).rejects.toThrow(field);
  });

  it('modificación: {} válido; Title o ArtistId en null → error; ImageUrl null válido', async () => {
    await expect(validateBody(UpdateAlbumDto, {})).resolves.toBeInstanceOf(
      UpdateAlbumDto,
    );
    await expect(validateBody(UpdateAlbumDto, { Title: null })).rejects.toThrow(
      /Title/,
    );
    await expect(
      validateBody(UpdateAlbumDto, { ArtistId: null }),
    ).rejects.toThrow(/ArtistId/);
    await expect(
      validateBody(UpdateAlbumDto, { ImageUrl: null }),
    ).resolves.toBeInstanceOf(UpdateAlbumDto);
  });
});
