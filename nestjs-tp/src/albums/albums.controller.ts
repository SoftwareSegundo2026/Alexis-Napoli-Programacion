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
import { AlbumsService } from './albums.service.js';
import { AlbumResponseDto } from './dto/album-response.dto.js';
import { CreateAlbumDto } from './dto/create-album.dto.js';
import { UpdateAlbumDto } from './dto/update-album.dto.js';

/** Facade HTTP de álbumes: rutas, conversión del id y códigos. Sin lógica de negocio. */
@ApiTags('albums')
@Controller('albums')
export class AlbumsController {
  constructor(private readonly albumsService: AlbumsService) {}

  @Get()
  @ApiOkResponse({ type: [AlbumResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<AlbumResponseDto[]> {
    const albums = await this.albumsService.findAll(query);
    return albums.map((album) => AlbumResponseDto.fromEntity(album));
  }

  @Get(':id')
  @ApiOkResponse({ type: AlbumResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AlbumResponseDto> {
    return AlbumResponseDto.fromEntity(await this.albumsService.findOne(id));
  }

  @Post()
  @ApiWriteOperation()
  @ApiCreatedResponse({ type: AlbumResponseDto })
  @ApiInvalidRequest()
  async create(@Body() dto: CreateAlbumDto): Promise<AlbumResponseDto> {
    return AlbumResponseDto.fromEntity(await this.albumsService.create(dto));
  }

  @Patch(':id')
  @ApiWriteOperation()
  @ApiOkResponse({ type: AlbumResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAlbumDto,
  ): Promise<AlbumResponseDto> {
    return AlbumResponseDto.fromEntity(
      await this.albumsService.update(id, dto),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiWriteOperation()
  @ApiNoContentResponse({ description: 'Eliminado' })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('El álbum tiene pistas')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.albumsService.remove(id);
  }
}
