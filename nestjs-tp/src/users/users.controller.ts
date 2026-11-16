import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import {
  ApiAuthenticated,
  ApiConflict,
  ApiInvalidRequest,
  ApiNotFound,
  ApiAdminOnly,
} from '../common/swagger/api-docs.decorators.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UserResponseDto } from './dto/user-response.dto.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

/**
 * Facade HTTP de usuarios. Nada es público: todas las rutas exigen credencial
 * (guard global); el listado y el alta, además, rol admin.
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Declarada antes que cualquier ruta con `:id`, para que "me" no se tome como id. */
  @Get('me')
  @ApiAuthenticated()
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() user: User): UserResponseDto {
    return UserResponseDto.fromEntity(user);
  }

  @Get()
  @Roles('admin')
  @ApiAdminOnly()
  @ApiOkResponse({ type: [UserResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<UserResponseDto[]> {
    const users = await this.usersService.findAll(query);
    return users.map((user) => UserResponseDto.fromEntity(user));
  }

  @Post()
  @Roles('admin')
  @ApiAdminOnly()
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiInvalidRequest()
  @ApiConflict('El username o el email ya están registrados')
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(await this.usersService.create(dto));
  }

  @Patch(':id')
  @Roles('admin')
  @ApiAdminOnly()
  @ApiOkResponse({ type: UserResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async update(
    @CurrentUser() actor: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return UserResponseDto.fromEntity(
      await this.usersService.update(actor, id, dto),
    );
  }
}
