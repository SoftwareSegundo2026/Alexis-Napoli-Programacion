import { ApiProperty } from '@nestjs/swagger';

/** Respuesta del login: igual al servicio original, y nada más (spec 002 RNF-1). */
export class TokenResponseDto {
  @ApiProperty({
    description: 'Credencial firmada; va en Authorization: Bearer',
  })
  access_token: string;

  @ApiProperty({ example: 'bearer' })
  token_type: 'bearer';

  static of(accessToken: string): TokenResponseDto {
    const dto = new TokenResponseDto();
    dto.access_token = accessToken;
    dto.token_type = 'bearer';
    return dto;
  }
}
