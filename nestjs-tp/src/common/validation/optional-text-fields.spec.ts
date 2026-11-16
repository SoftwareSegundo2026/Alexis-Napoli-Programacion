import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { CreateAlbumDto } from '../../albums/dto/create-album.dto.js';
import { UpdateAlbumDto } from '../../albums/dto/update-album.dto.js';
import { CreateArtistDto } from '../../artists/dto/create-artist.dto.js';
import { UpdateArtistDto } from '../../artists/dto/update-artist.dto.js';
import { CreateTrackDto } from '../../tracks/dto/create-track.dto.js';
import { UpdateTrackDto } from '../../tracks/dto/update-track.dto.js';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';
import { RequestValidationPipe } from './request-validation.pipe.js';

/**
 * Spec 005 RF-8 (bug 3 del TP-1): un texto OPCIONAL vacío o de solo espacios
 * se trata igual que `null`. Antes se guardaba `""`, contra la regla "un texto
 * formado solo por espacios cuenta como vacío" de las specs 001 y 002.
 */
const pipe = new RequestValidationPipe();

function parseBody(metatype: ArgumentMetadata['metatype'], body: object) {
  return pipe.transform(body, { type: 'body', metatype, data: undefined });
}

/** Cada opcional de texto, con el resto de un cuerpo válido de su DTO. */
const OPTIONAL_TEXT_FIELDS: Array<
  [string, ArgumentMetadata['metatype'], string, object]
> = [
  ['alta de artista', CreateArtistDto, 'ImageUrl', { Name: 'Artista' }],
  ['modificación de artista', UpdateArtistDto, 'ImageUrl', {}],
  [
    'alta de álbum',
    CreateAlbumDto,
    'ImageUrl',
    { Title: 'Álbum', ArtistId: 1 },
  ],
  ['modificación de álbum', UpdateAlbumDto, 'ImageUrl', {}],
  [
    'alta de pista',
    CreateTrackDto,
    'Composer',
    { Name: 'Pista', MediaTypeId: 1, Milliseconds: 1000, UnitPrice: 0.99 },
  ],
  ['modificación de pista', UpdateTrackDto, 'Composer', {}],
  [
    'alta de usuario',
    CreateUserDto,
    'full_name',
    {
      username: 'ana.perez',
      email: 'ana@example.com',
      password: 'clave-de-prueba-123',
    },
  ],
];

describe('Textos opcionales vacíos → null (spec 005 RF-8)', () => {
  describe.each(OPTIONAL_TEXT_FIELDS)('%s', (_label, metatype, field, rest) => {
    it.each(['', '   '])(
      `${field} = %j → null (casos 12–14)`,
      async (value) => {
        const result = await parseBody(metatype, { ...rest, [field]: value });

        expect(result).toMatchObject({ [field]: null });
      },
    );

    it(`${field} con texto se sigue recortando`, async () => {
      const result = await parseBody(metatype, {
        ...rest,
        [field]: '  con texto  ',
      });

      expect(result).toMatchObject({ [field]: 'con texto' });
    });
  });

  it('un OBLIGATORIO de solo espacios sigue → 400 (caso 15)', async () => {
    const result = parseBody(CreateArtistDto, { Name: '   ' });

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow('Name should not be empty');
  });
});
