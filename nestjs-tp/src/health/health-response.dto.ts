import { ApiProperty } from '@nestjs/swagger';

/** Respuesta de `GET /health` con la base arriba (spec 007 RF-5). */
export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: 'ok';

  @ApiProperty({ example: 'up' })
  database: 'up';
}

/** Respuesta de `GET /health` con la base caída: trae `detail` como todo error. */
export class HealthDownResponseDto {
  @ApiProperty({ example: 'error' })
  status: 'error';

  @ApiProperty({ example: 'down' })
  database: 'down';

  @ApiProperty({ example: 'Database unavailable' })
  detail: string;
}
