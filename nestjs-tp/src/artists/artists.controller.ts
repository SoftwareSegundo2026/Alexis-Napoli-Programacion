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
import { ArtistsService } from './artists.service.js';
import { ArtistResponseDto } from './dto/artist-response.dto.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';

/** Facade HTTP de artistas: rutas, conversión del id y códigos. Sin lógica de negocio. */
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<ArtistResponseDto[]> {
    const artists = await this.artistsService.findAll(query);
    return artists.map((artist) => ArtistResponseDto.fromEntity(artist));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ArtistResponseDto> {
    return ArtistResponseDto.fromEntity(await this.artistsService.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreateArtistDto): Promise<ArtistResponseDto> {
    return ArtistResponseDto.fromEntity(await this.artistsService.create(dto));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArtistDto,
  ): Promise<ArtistResponseDto> {
    return ArtistResponseDto.fromEntity(
      await this.artistsService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.artistsService.remove(id);
  }
}
