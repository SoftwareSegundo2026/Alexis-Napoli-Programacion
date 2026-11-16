import { ArgumentMetadata } from '@nestjs/common';
import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { Artist } from '../entities/artist.entity.js';
import { ArtistResponseDto } from './artist-response.dto.js';
import { CreateArtistDto } from './create-artist.dto.js';
import { UpdateArtistDto } from './update-artist.dto.js';

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

describe('DTOs de artistas (RF-9)', () => {
  it('alta: Name obligatorio, no vacío, máximo 120', async () => {
    await expect(validateBody(CreateArtistDto, {})).rejects.toThrow(/Name/);
    await expect(validateBody(CreateArtistDto, { Name: '  ' })).rejects.toThrow(
      /Name/,
    );
    await expect(
      validateBody(CreateArtistDto, { Name: 'x'.repeat(121) }),
    ).rejects.toThrow(/Name/);
  });

  it('alta: ImageUrl opcional, texto de hasta 500', async () => {
    await expect(
      validateBody(CreateArtistDto, { Name: 'A', ImageUrl: '/x'.repeat(250) }),
    ).resolves.toBeInstanceOf(CreateArtistDto);
    await expect(
      validateBody(CreateArtistDto, { Name: 'A', ImageUrl: 'x'.repeat(501) }),
    ).rejects.toThrow(/ImageUrl/);
    await expect(
      validateBody(CreateArtistDto, { Name: 'A', ImageUrl: 5 }),
    ).rejects.toThrow(/ImageUrl/);
  });

  it('modificación: {} es válido; Name en null no; ImageUrl en null sí', async () => {
    await expect(validateBody(UpdateArtistDto, {})).resolves.toBeInstanceOf(
      UpdateArtistDto,
    );
    await expect(validateBody(UpdateArtistDto, { Name: null })).rejects.toThrow(
      /Name/,
    );
    await expect(
      validateBody(UpdateArtistDto, { ImageUrl: null }),
    ).resolves.toEqual(expect.objectContaining({ ImageUrl: null }));
  });

  it('respuesta: solo los campos del contrato (RNF-2)', () => {
    const entity = Object.assign(new Artist(), {
      id: 1,
      name: 'AC/DC',
      imageUrl: '/img/1.jpg',
    });

    expect(ArtistResponseDto.fromEntity(entity)).toEqual({
      ArtistId: 1,
      Name: 'AC/DC',
      ImageUrl: '/img/1.jpg',
    });
  });
});
