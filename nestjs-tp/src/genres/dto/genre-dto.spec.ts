import { ArgumentMetadata } from '@nestjs/common';
import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { Genre } from '../entities/genre.entity.js';
import { CreateGenreDto } from './create-genre.dto.js';
import { GenreResponseDto } from './genre-response.dto.js';
import { UpdateGenreDto } from './update-genre.dto.js';

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

describe('DTOs de géneros (RF-9)', () => {
  describe('CreateGenreDto', () => {
    it('Name es obligatorio', async () => {
      await expect(validateBody(CreateGenreDto, {})).rejects.toThrow(/Name/);
    });

    it('Name no puede ser solo espacios ni pasar de 120 caracteres', async () => {
      await expect(
        validateBody(CreateGenreDto, { Name: '   ' }),
      ).rejects.toThrow(/Name/);
      await expect(
        validateBody(CreateGenreDto, { Name: 'x'.repeat(121) }),
      ).rejects.toThrow(/Name/);
    });

    it('acepta 120 caracteres y recorta los espacios', async () => {
      await expect(
        validateBody(CreateGenreDto, { Name: ` ${'x'.repeat(120)} ` }),
      ).resolves.toEqual({ Name: 'x'.repeat(120) });
    });
  });

  describe('UpdateGenreDto', () => {
    it('un cuerpo vacío es válido (modificación parcial)', async () => {
      await expect(validateBody(UpdateGenreDto, {})).resolves.toBeInstanceOf(
        UpdateGenreDto,
      );
    });

    it('Name no puede enviarse en null ni vacío', async () => {
      await expect(
        validateBody(UpdateGenreDto, { Name: null }),
      ).rejects.toThrow(/Name/);
      await expect(
        validateBody(UpdateGenreDto, { Name: '  ' }),
      ).rejects.toThrow(/Name/);
    });
  });

  describe('GenreResponseDto (RNF-2)', () => {
    it('expone solo los campos del contrato', () => {
      const entity = Object.assign(new Genre(), { id: 1, name: 'Rock' });

      expect(GenreResponseDto.fromEntity(entity)).toEqual({
        GenreId: 1,
        Name: 'Rock',
      });
    });
  });
});
