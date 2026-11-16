import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  ApiAdminOnly,
  ApiAuthenticated,
  ApiConflict,
  ApiInvalidRequest,
  ApiNotFound,
} from '../common/swagger/api-docs.decorators.js';
import { User } from '../users/entities/user.entity.js';
import { CreateReservationDto } from './dto/create-reservation.dto.js';
import { ReservationResponseDto } from './dto/reservation-response.dto.js';
import { IdempotencyKey } from './idempotency-key.decorator.js';
import { ReservationsService } from './reservations.service.js';

/** Facade HTTP de reservas (spec 004). Todas exigen credencial (cualquier rol). */
@ApiTags('reservations')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiAuthenticated()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Clave del intento (8–100 caracteres): reintentar con la misma no cobra dos veces',
  })
  @ApiCreatedResponse({ type: ReservationResponseDto })
  @ApiInvalidRequest()
  @ApiResponse({
    status: 402,
    type: ErrorResponseDto,
    description:
      'El medio de pago rechazó el cobro (no queda ni reserva ni pago)',
  })
  @ApiNotFound()
  @ApiConflict('Sin entradas suficientes, o la clave ya se usó con otro pedido')
  async create(
    @CurrentUser() user: User,
    @IdempotencyKey() idempotencyKey: string,
    @Body() dto: CreateReservationDto,
  ): Promise<ReservationResponseDto> {
    return ReservationResponseDto.fromEntity(
      await this.reservationsService.create(user, dto, idempotencyKey),
    );
  }

  @Get()
  @ApiAuthenticated()
  @ApiOkResponse({ type: [ReservationResponseDto] })
  @ApiInvalidRequest()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: PaginationQueryDto,
  ): Promise<ReservationResponseDto[]> {
    const reservations = await this.reservationsService.findAll(user, query);
    return reservations.map((r) => ReservationResponseDto.fromEntity(r));
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiAuthenticated()
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('Completada, o el concierto ya empezó')
  async cancel(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReservationResponseDto> {
    return ReservationResponseDto.fromEntity(
      await this.reservationsService.cancel(user, id),
    );
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @Roles('admin')
  @ApiAdminOnly()
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  @ApiConflict('Cancelada, o el concierto todavía no empezó')
  async complete(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReservationResponseDto> {
    return ReservationResponseDto.fromEntity(
      await this.reservationsService.complete(id),
    );
  }

  @Get(':id')
  @ApiAuthenticated()
  @ApiOkResponse({ type: ReservationResponseDto })
  @ApiInvalidRequest()
  @ApiNotFound()
  async findOne(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ReservationResponseDto> {
    return ReservationResponseDto.fromEntity(
      await this.reservationsService.findOne(user, id),
    );
  }
}
