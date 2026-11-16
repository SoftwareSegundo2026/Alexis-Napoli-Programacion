import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtistsRepository } from '../artists/artists.repository.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { Clock } from '../database/clock.js';
import {
  ConcertsRepository,
  type ConcertWithAvailability,
} from './concerts.repository.js';
import { CreateConcertDto } from './dto/create-concert.dto.js';

/** Reglas de conciertos (spec 004 RF-1, RF-2): artista existente y fecha futura. */
@Injectable()
export class ConcertsService {
  constructor(
    private readonly concerts: ConcertsRepository,
    private readonly artists: ArtistsRepository,
    private readonly clock: Clock,
  ) {}

  findAll({
    skip,
    limit,
  }: PaginationQueryDto): Promise<ConcertWithAvailability[]> {
    return this.concerts.findPage(skip, limit);
  }

  async findOne(id: number): Promise<ConcertWithAvailability> {
    const found = await this.concerts.findById(id);
    if (found === null) {
      throw new NotFoundException('Concert not found');
    }
    return found;
  }

  async create(dto: CreateConcertDto): Promise<ConcertWithAvailability> {
    if ((await this.artists.findById(dto.ArtistId)) === null) {
      throw new BadRequestException(
        `ArtistId ${dto.ArtistId} does not match any artist`,
      );
    }
    const startsAt = new Date(dto.StartsAt);
    if (startsAt.getTime() <= this.clock.now().getTime()) {
      throw new BadRequestException('StartsAt must be in the future');
    }
    return this.concerts.create({
      artistId: dto.ArtistId,
      title: dto.Title,
      // Siempre en UTC: así se ordena y se compara como texto sin sorpresas.
      startsAt: startsAt.toISOString(),
      capacity: dto.Capacity,
      price: dto.Price,
    });
  }
}
