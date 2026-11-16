import { RequestValidationPipe } from '../../common/validation/request-validation.pipe.js';
import { UpdateUserDto } from './update-user.dto.js';

function validate(body: unknown): Promise<unknown> {
  return new RequestValidationPipe().transform(body, {
    type: 'body',
    metatype: UpdateUserDto,
    data: undefined,
  });
}

describe('UpdateUserDto (spec 002, tabla de reglas: modificación)', () => {
  it('acepta {} y cualquiera de los dos booleanos', async () => {
    await expect(validate({})).resolves.toBeInstanceOf(UpdateUserDto);
    await expect(
      validate({ disabled: true, is_admin: false }),
    ).resolves.toEqual(
      expect.objectContaining({ disabled: true, is_admin: false }),
    );
  });

  it.each([
    [{ disabled: null }, /disabled/],
    [{ is_admin: null }, /is_admin/],
    [{ disabled: 'true' }, /disabled/],
    [{ is_admin: 1 }, /is_admin/],
    [{ password: 'nueva-clave-123' }, /password/],
    [{ username: 'otro' }, /username/],
  ])('%j → 400 que nombra el campo', async (body, field) => {
    await expect(validate(body)).rejects.toThrow(field);
  });
});
