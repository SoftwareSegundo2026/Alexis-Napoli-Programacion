import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { TokenResponseDto } from './dto/token-response.dto.js';

/** Facade HTTP del login. El único endpoint público de escritura (spec 002). */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('token')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Faltan username o password, o no son texto',
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      'Incorrect username or password (mismo mensaje en todos los casos)',
  })
  async login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return TokenResponseDto.of(
      await this.auth.login(dto.username, dto.password),
    );
  }
}
