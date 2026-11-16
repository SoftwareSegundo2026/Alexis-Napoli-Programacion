import { ArgumentMetadata } from '@nestjs/common';
import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { Album } from '../../albums/entities/album.entity.js';
import { Genre } from '../../genres/entities/genre.entity.js';
import { MediaType } from '../entities/media-type.entity.js';
import { Track } from '../entities/track.entity.js';
import { CreateTrackDto } from './create-track.dto.js';
import { TrackResponseDto } from './track-response.dto.js';
import { UpdateTrackDto } from './update-track.dto.js';

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

const valid = {
  Name: 'Nueva',
  MediaTypeId: 1,
  Milliseconds: 1000,
  UnitPrice: 0.99,
};

describe('DTOs de pistas (RF-9)', () => {
  it('alta válida con los obligatorios; los opcionales pueden venir', async () => {
    await expect(validateBody(CreateTrackDto, valid)).resolves.toBeInstanceOf(
      CreateTrackDto,
    );
    await expect(
      validateBody(CreateTrackDto, {
        ...valid,
        AlbumId: 1,
        GenreId: null,
        Composer: '  Alguien  ',
        Bytes: 0,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ Composer: 'Alguien', Bytes: 0 }),
    );
  });

  it.each([
    [{ ...valid, Name: undefined }, /Name/],
    [{ ...valid, Name: '   ' }, /Name/],
    [{ ...valid, Name: 'x'.repeat(201) }, /Name/],
    [{ ...valid, MediaTypeId: undefined }, /MediaTypeId/],
    [{ ...valid, Milliseconds: 0 }, /Milliseconds/],
    [{ ...valid, Milliseconds: 1.5 }, /Milliseconds/],
    [{ ...valid, Bytes: -1 }, /Bytes/],
    [{ ...valid, UnitPrice: -0.01 }, /UnitPrice/],
    [{ ...valid, UnitPrice: 0.999 }, /UnitPrice/],
    [{ ...valid, UnitPrice: '0.99' }, /UnitPrice/],
    [{ ...valid, Composer: 'x'.repeat(221) }, /Composer/],
    [{ ...valid, AlbumId: 'uno' }, /AlbumId/],
    [{ ...valid, GenreName: 'Rock' }, /GenreName/],
  ])('alta inválida → nombra el campo (%#)', async (body, field) => {
    await expect(validateBody(CreateTrackDto, body)).rejects.toThrow(field);
  });

  it('modificación: {} válido; obligatorios en null → error; opcionales en null → válido', async () => {
    await expect(validateBody(UpdateTrackDto, {})).resolves.toBeInstanceOf(
      UpdateTrackDto,
    );
    for (const field of ['Name', 'MediaTypeId', 'Milliseconds', 'UnitPrice']) {
      await expect(
        validateBody(UpdateTrackDto, { [field]: null }),
      ).rejects.toThrow(new RegExp(field));
    }
    await expect(
      validateBody(UpdateTrackDto, {
        AlbumId: null,
        GenreId: null,
        Composer: null,
        Bytes: null,
      }),
    ).resolves.toBeInstanceOf(UpdateTrackDto);
  });
});

describe('TrackResponseDto (RF-5, RNF-2)', () => {
  const base = Object.assign(new Track(), {
    id: 1,
    name: 'Pista',
    albumId: 1,
    mediaTypeId: 1,
    genreId: 1,
    composer: null,
    milliseconds: 1000,
    bytes: 10,
    unitPrice: 0.99,
    mediaType: Object.assign(new MediaType(), {
      id: 1,
      name: 'MPEG audio file',
    }),
  });

  it('incluye AlbumTitle, GenreName y MediaTypeName, y nada más', () => {
    const entity = Object.assign(new Track(), base, {
      album: Object.assign(new Album(), { id: 1, title: 'Álbum' }),
      genre: Object.assign(new Genre(), { id: 1, name: 'Rock' }),
    });

    expect(TrackResponseDto.fromEntity(entity)).toEqual({
      TrackId: 1,
      Name: 'Pista',
      AlbumId: 1,
      MediaTypeId: 1,
      GenreId: 1,
      Composer: null,
      Milliseconds: 1000,
      Bytes: 10,
      UnitPrice: 0.99,
      AlbumTitle: 'Álbum',
      GenreName: 'Rock',
      MediaTypeName: 'MPEG audio file',
    });
  });

  it('sin álbum ni género, esos campos valen null', () => {
    const entity = Object.assign(new Track(), base, {
      albumId: null,
      genreId: null,
      album: null,
      genre: null,
    });

    const dto = TrackResponseDto.fromEntity(entity);

    expect(dto.AlbumTitle).toBeNull();
    expect(dto.GenreName).toBeNull();
  });
});
