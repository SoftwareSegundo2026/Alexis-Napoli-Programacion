import { ApiProperty } from '@nestjs/swagger';

/** Cuerpo de todo error de la API (lo arma `DetailExceptionFilter`). Solo documenta. */
export class ErrorResponseDto {
  @ApiProperty({ example: 'Album not found' })
  detail: string;
}
