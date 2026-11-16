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
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import {
  ApiConflict,
  ApiInvalidRequest,
  ApiNotFound,
  ApiWriteOperation,
} from '../common/swagger/api-docs.decorators.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { TrackResponseDto } from './dto/track-response.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { TracksService } from './tracks.service.js';

/** Facade HTTP de pistas: rutas, conversión del id y códigos. Sin lógica de negocio. */
@ApiTags('tracks')
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  @ApiOkResponse({ type: [TrackResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<TrackResponseDto[]> {
    const tracks = await this.tracksService.findAll(query);
    return tracks.map((track) => TrackResponseDto.fromEntity(track));
  }

  @Get(':id')
  @ApiOkResponse({ type: TrackResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(await this.tracksService.findOne(id));
  }

  @Post()
  @ApiWriteOperation()
  @ApiCreatedResponse({ type: TrackResponseDto })
  @ApiInvalidRequest()
  async create(@Body() dto: CreateTrackDto): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(await this.tracksService.create(dto));
  }

  @Patch(':id')
  @ApiWriteOperation()
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
  @ApiWriteOperation()
  @ApiNoContentResponse({ description: 'Eliminada' })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('La pista está en facturas o playlists')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tracksService.remove(id);
  }
}
