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
  ApiOperation,
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
import { CreateTrackDto } from './dto/create-track.dto.js';
import { SearchTracksQueryDto } from './dto/search-tracks-query.dto.js';
import { TrackResponseDto } from './dto/track-response.dto.js';
import { TrackSearchPageDto } from './dto/track-search-page.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { TracksService } from './tracks.service.js';

/** Facade HTTP de pistas: rutas, conversión del id y códigos. Sin lógica de negocio. */
@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: [TrackResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<TrackResponseDto[]> {
    const tracks = await this.tracksService.findAll(query);
    return tracks.map((track) => TrackResponseDto.fromEntity(track));
  }

  // DEBE ir antes de @Get(':id'): si no, Nest toma "search" como un id y
  // ParseIntPipe responde 400 (spec 003, plan).
  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Buscar pistas con filtros combinados, orden y paginación',
    description:
      'Todos los filtros son opcionales y se combinan con Y. Sin filtros devuelve todas las pistas, paginadas. Un filtro sin coincidencias responde 200 con items vacío.',
  })
  @ApiOkResponse({ type: TrackSearchPageDto })
  @ApiInvalidRequest()
  async search(
    @Query() query: SearchTracksQueryDto,
  ): Promise<TrackSearchPageDto> {
    const page = await this.tracksService.search(query);
    return {
      ...page,
      items: page.items.map((track) => TrackResponseDto.fromEntity(track)),
    };
  }

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: TrackResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(await this.tracksService.findOne(id));
  }

  @Post()
  @Roles('admin')
  @ApiAdminOnly()
  @ApiCreatedResponse({ type: TrackResponseDto })
  @ApiInvalidRequest()
  async create(@Body() dto: CreateTrackDto): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(await this.tracksService.create(dto));
  }

  @Patch(':id')
  @Roles('admin')
  @ApiAdminOnly()
  @ApiOkResponse({ type: TrackResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackDto,
  ): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(
      await this.tracksService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('admin')
  @ApiAdminOnly()
  @ApiNoContentResponse({ description: 'Eliminada' })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('La pista está en facturas o playlists')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tracksService.remove(id);
  }
}
