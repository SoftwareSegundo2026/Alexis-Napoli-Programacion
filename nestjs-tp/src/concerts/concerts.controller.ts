import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import {
  ApiAdminOnly,
  ApiInvalidRequest,
  ApiNotFound,
} from '../common/swagger/api-docs.decorators.js';
import { ConcertsService } from './concerts.service.js';
import { ConcertResponseDto } from './dto/concert-response.dto.js';
import { CreateConcertDto } from './dto/create-concert.dto.js';

/** Facade HTTP de conciertos (spec 004). Lecturas públicas; alta solo admin. */
@ApiTags('concerts')
@Controller('concerts')
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  @Public()
  @ApiOkResponse({ type: [ConcertResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @Query() query: PaginationQueryDto,
  ): Promise<ConcertResponseDto[]> {
    const concerts = await this.concertsService.findAll(query);
    return concerts.map((concert) => ConcertResponseDto.fromEntity(concert));
  }

  @Get(':id')
  @Public()
  @ApiOkResponse({ type: ConcertResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ConcertResponseDto> {
    return ConcertResponseDto.fromEntity(
      await this.concertsService.findOne(id),
    );
  }

  @Post()
  @Roles('admin')
  @ApiAdminOnly()
  @ApiCreatedResponse({ type: ConcertResponseDto })
  @ApiInvalidRequest()
  async create(@Body() dto: CreateConcertDto): Promise<ConcertResponseDto> {
    return ConcertResponseDto.fromEntity(
      await this.concertsService.create(dto),
    );
  }
}
