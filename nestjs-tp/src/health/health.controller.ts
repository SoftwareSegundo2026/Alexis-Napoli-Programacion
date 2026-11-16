import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { DatabaseProbe } from './database-probe.js';
import {
  HealthDownResponseDto,
  HealthResponseDto,
} from './health-response.dto.js';

/** Lo único que se usa de la respuesta de Express (así se prueba sin casts). */
export interface StatusSetter {
  status(code: number): unknown;
}

/**
 * Chequeo de salud (spec 007 RF-5): lo consultan Docker (healthcheck) y el
 * despliegue para saber si la app está lista. Público y fuera de `/api/v1`.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly probe: DatabaseProbe) {}

  @Get()
  @ApiOkResponse({ type: HealthResponseDto, description: 'App y base arriba' })
  @ApiServiceUnavailableResponse({
    type: HealthDownResponseDto,
    description: 'La base no responde: la app no está lista',
  })
  async check(
    // passthrough: Nest sigue armando la respuesta; solo se cambia el código.
    // (Con una excepción, el filtro global dejaría solo `{detail}`.)
    @Res({ passthrough: true }) response: StatusSetter,
  ): Promise<HealthResponseDto | HealthDownResponseDto> {
    if (await this.probe.isUp()) {
      return { status: 'ok', database: 'up' };
    }
    response.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: 'error',
      database: 'down',
      detail: 'Database unavailable',
    };
  }
}
