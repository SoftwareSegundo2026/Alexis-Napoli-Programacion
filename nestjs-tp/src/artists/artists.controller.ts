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
  ApiWriteOperation,
} from '../common/swagger/api-docs.decorators.js';
import { ArtistsService } from './artists.service.js';
import { ArtistResponseDto } from './dto/artist-response.dto.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';

/** Facade HTTP de artistas: rutas, conversión del id y códigos. Sin lógica de negocio. */
@ApiTags('artists')
@Controller('artists')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: [ArtistResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<ArtistResponseDto[]> {
    const artists = await this.artistsService.findAll(query);
    return artists.map((artist) => ArtistResponseDto.fromEntity(artist));
  }

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: ArtistResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ArtistResponseDto> {
    return ArtistResponseDto.fromEntity(await this.artistsService.findOne(id));
  }

  @Post()
  @Roles('admin')
  @ApiWriteOperation()
  @ApiCreatedResponse({ type: ArtistResponseDto })
  @ApiInvalidRequest()
  @ApiConflict('Ya existe un artista con ese nombre')
  async create(@Body() dto: CreateArtistDto): Promise<ArtistResponseDto> {
    return ArtistResponseDto.fromEntity(await this.artistsService.create(dto));
  }

  @Patch(':id')
  @Roles('admin')
  @ApiWriteOperation()
  @ApiOkResponse({ type: ArtistResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('Ya existe otro artista con ese nombre')
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
  @Roles('admin')
  @ApiWriteOperation()
  @ApiNoContentResponse({ description: 'Eliminado' })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('El artista tiene álbumes')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.artistsService.remove(id);
  }
}
