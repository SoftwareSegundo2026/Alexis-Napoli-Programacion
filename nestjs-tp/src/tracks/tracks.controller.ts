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
import { CreateTrackDto } from './dto/create-track.dto.js';
import { TrackResponseDto } from './dto/track-response.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { TracksService } from './tracks.service.js';

/** Facade HTTP de pistas: rutas, conversión del id y códigos. Sin lógica de negocio. */
@Controller('tracks')
export class TracksController {
  constructor(private readonly tracksService: TracksService) {}

  @Get()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<TrackResponseDto[]> {
    const tracks = await this.tracksService.findAll(query);
    return tracks.map((track) => TrackResponseDto.fromEntity(track));
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(await this.tracksService.findOne(id));
  }

  @Post()
  async create(@Body() dto: CreateTrackDto): Promise<TrackResponseDto> {
    return TrackResponseDto.fromEntity(await this.tracksService.create(dto));
  }

  @Patch(':id')
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
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.tracksService.remove(id);
  }
}
