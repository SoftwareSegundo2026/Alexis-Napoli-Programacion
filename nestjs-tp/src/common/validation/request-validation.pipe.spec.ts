import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RequestValidationPipe } from './request-validation.pipe.js';
import { Trim } from './trim.decorator.js';

/** DTO de ejemplo con las reglas típicas de un alta (RF-9). */
class SampleCreateDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  Name: string;

  @IsOptional()
  @IsString()
  ImageUrl?: string;
}

const bodyMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: SampleCreateDto,
  data: undefined,
};

describe('RequestValidationPipe (RF-9)', () => {
  const pipe = new RequestValidationPipe();

  it('un cuerpo válido llega al controller como instancia del DTO', async () => {
    const result = await pipe.transform({ Name: 'Rock' }, bodyMetadata);

    expect(result).toBeInstanceOf(SampleCreateDto);
    expect(result).toEqual({ Name: 'Rock' });
  });

  it('recorta los espacios de los extremos antes de guardar', async () => {
    await expect(
      pipe.transform({ Name: '  Rock  ' }, bodyMetadata),
    ).resolves.toEqual({ Name: 'Rock' });
  });

  it('un texto de solo espacios cuenta como vacío → 400 que nombra el campo', async () => {
    const result = pipe.transform({ Name: '   ' }, bodyMetadata);

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow('Name should not be empty');
  });

  it('un campo desconocido en el cuerpo → 400 que lo nombra', async () => {
    const result = pipe.transform({ Name: 'Rock', Foo: 1 }, bodyMetadata);

    await expect(result).rejects.toBeInstanceOf(BadRequestException);
    await expect(result).rejects.toThrow('property Foo should not exist');
  });

  it('con varios problemas informa un solo mensaje (string, no lista)', async () => {
    const error: unknown = await pipe
      .transform({ Name: 'nombre demasiado largo', ImageUrl: 5 }, bodyMetadata)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse();
    expect(typeof response === 'object' && 'message' in response).toBe(true);
    expect(typeof (response as { message: unknown }).message).toBe('string');
  });

  it('los parámetros primitivos (como el id de la ruta) pasan sin tocarse', async () => {
    await expect(
      pipe.transform('7', { type: 'param', metatype: String, data: 'id' }),
    ).resolves.toBe('7');
  });
});
