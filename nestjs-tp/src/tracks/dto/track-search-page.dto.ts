import { ApiProperty } from '@nestjs/swagger';
import type { Page } from '../../common/dto/page.dto.js';
import { TrackResponseDto } from './track-response.dto.js';

/**
 * Respuesta de `GET /tracks/search` (spec 003 RF-6), para la documentación. Es
 * la forma única `Page<T>` con pistas: Swagger no documenta tipos genéricos,
 * así que cada página concreta se declara como clase. Solo documenta.
 */
export class TrackSearchPageDto implements Page<TrackResponseDto> {
  @ApiProperty({ type: [TrackResponseDto] })
  items: TrackResponseDto[];

  @ApiProperty({
    example: 174,
    description: 'Pistas que cumplen los filtros, sin paginar',
  })
  total: number;

  @ApiProperty({ example: 0, description: 'skip aplicado' })
  skip: number;

  @ApiProperty({ example: 100, description: 'limit aplicado' })
  limit: number;

  @ApiProperty({
    example: true,
    description: '¿Quedan pistas después de esta página?',
  })
  hasMore: boolean;
}
