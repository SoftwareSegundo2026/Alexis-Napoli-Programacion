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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateGenreDto } from './dto/create-genre.dto.js';
import { GenreResponseDto } from './dto/genre-response.dto.js';
import { UpdateGenreDto } from './dto/update-genre.dto.js';
import { GenresService } from './genres.service.js';

/** Facade HTTP de géneros: rutas, conversión del id y códigos. Sin lógica de negocio. */
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Get()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<GenreResponseDto[]> {
    const genres = await this.genresService.findAll(query);
    return genres.map((genre) => GenreResponseDto.fromEntity(genre));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GenreResponseDto> {
    return GenreResponseDto.fromEntity(await this.genresService.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreateGenreDto): Promise<GenreResponseDto> {
    return GenreResponseDto.fromEntity(await this.genresService.create(dto));
  }

  @Patch(':id')
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
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.genresService.remove(id);
  }
}
