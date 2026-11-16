import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import {
  ApiConflict,
  ApiInvalidRequest,
  ApiNotFound,
  ApiAdminOnly,
} from '../common/swagger/api-docs.decorators.js';
import { CreateGenreDto } from './dto/create-genre.dto.js';
import { GenreResponseDto } from './dto/genre-response.dto.js';
import { UpdateGenreDto } from './dto/update-genre.dto.js';
import { GenresService } from './genres.service.js';

/** Facade HTTP de géneros: rutas, conversión del id y códigos. Sin lógica de negocio. */
@ApiTags('genres')
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: [GenreResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<GenreResponseDto[]> {
    const genres = await this.genresService.findAll(query);
    return genres.map((genre) => GenreResponseDto.fromEntity(genre));
  }

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: GenreResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GenreResponseDto> {
    return GenreResponseDto.fromEntity(await this.genresService.findOne(id));
  }

  @Post()
  @Roles('admin')
  @ApiAdminOnly()
  @ApiCreatedResponse({ type: GenreResponseDto })
  @ApiInvalidRequest()
  @ApiConflict('Ya existe un género con ese nombre')
  async create(@Body() dto: CreateGenreDto): Promise<GenreResponseDto> {
    return GenreResponseDto.fromEntity(await this.genresService.create(dto));
  }

  @Patch(':id')
  @Roles('admin')
  @ApiAdminOnly()
  @ApiOkResponse({ type: GenreResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('Ya existe otro género con ese nombre')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGenreDto,
  ): Promise<GenreResponseDto> {
    return GenreResponseDto.fromEntity(
      await this.genresService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @ApiAdminOnly()
  @ApiNoContentResponse({ description: 'Eliminado' })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('Hay pistas que usan el género')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.genresService.remove(id);
  }
}
