import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { DetailExceptionFilter } from './detail-exception.filter.js';

/** Respuesta de Express simulada: `status()` encadena con `json()`. */
function createHost() {
  const response = { status: vi.fn(), json: vi.fn() };
  response.status.mockReturnValue(response);
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('DetailExceptionFilter (contrato {"detail"})', () => {
  const filter = new DetailExceptionFilter();
  let logError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // El filtro registra los errores no previstos; en los tests no ensucia la salida.
    logError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('una HttpException responde su código con {"detail": mensaje}', () => {
    const { host, response } = createHost();

    filter.catch(new NotFoundException('Album not found'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({ detail: 'Album not found' });
  });

  it('conserva el código de cualquier HttpException (401, 409)', () => {
    const unauthorized = createHost();
    filter.catch(
      new UnauthorizedException('Invalid write key'),
      unauthorized.host,
    );
    expect(unauthorized.response.status).toHaveBeenCalledWith(401);
    expect(unauthorized.response.json).toHaveBeenCalledWith({
      detail: 'Invalid write key',
    });

    const conflict = createHost();
    filter.catch(new HttpException('Artist has albums', 409), conflict.host);
    expect(conflict.response.status).toHaveBeenCalledWith(409);
    expect(conflict.response.json).toHaveBeenCalledWith({
      detail: 'Artist has albums',
    });
  });

  it('si el mensaje es una lista de errores informa solo el primero', () => {
    const { host, response } = createHost();

    filter.catch(
      new BadRequestException([
        'Name should not be empty',
        'ImageUrl must be shorter than or equal to 500 characters',
      ]),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      detail: 'Name should not be empty',
    });
  });

  it('JSON malformado (Nest lo convierte en BadRequestException) → 400 con detail', () => {
    const { host, response } = createHost();
    const parserError = new SyntaxError(
      "Expected property name or '}' in JSON at position 1",
    );

    // Lo mismo que hace el adaptador de Express de Nest antes de llamar a los filtros.
    filter.catch(new BadRequestException(parserError.message), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({ detail: parserError.message });
  });

  it('un error no previsto responde 500 genérico, sin filtrar el mensaje interno', () => {
    const { host, response } = createHost();

    filter.catch(new Error('SQLITE_ERROR: no such column: secreto'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith({
      detail: 'Internal Server Error',
    });
    expect(logError).toHaveBeenCalled();
  });

  it('algo lanzado que no es un Error también responde 500 genérico', () => {
    const { host, response } = createHost();

    filter.catch('texto suelto', host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      detail: 'Internal Server Error',
    });
  });
});
