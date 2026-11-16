import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, type SelectQueryBuilder } from 'typeorm';
import { Concert } from './entities/concert.entity.js';

/** Un concierto con su disponibilidad calculada (spec 004 RF-2). */
export interface ConcertWithAvailability {
  concert: Concert;
  available: number;
}

/** Datos de un concierto nuevo (sin id). */
export interface NewConcert {
  artistId: number;
  title: string;
  startsAt: string;
  capacity: number;
  price: number;
}

/**
 * Disponibilidad = capacidad − entradas de reservas PAID y COMPLETED (RF-2). Se
 * calcula en la misma consulta: ningún campo la guarda ni se suma a mano.
 */
const AVAILABLE_SQL = `"concert"."Capacity" - COALESCE((SELECT SUM("r"."Quantity") FROM "Reservation" "r" WHERE "r"."ConcertId" = "concert"."ConcertId" AND "r"."Status" IN ('PAID', 'COMPLETED')), 0)`;

/** DAO de conciertos. */
@Injectable()
export class ConcertsRepository {
  constructor(
    @InjectRepository(Concert) private readonly concerts: Repository<Concert>,
  ) {}

  /** Página ordenada por fecha (y por id ante empates), con la disponibilidad. */
  async findPage(
    skip: number,
    limit: number,
  ): Promise<ConcertWithAvailability[]> {
    return this.withAvailability(
      this.baseQuery()
        .orderBy('concert.startsAt', 'ASC')
        .addOrderBy('concert.id', 'ASC')
        .offset(skip)
        .limit(limit),
    );
  }

  async findById(
    id: number,
    manager?: EntityManager,
  ): Promise<ConcertWithAvailability | null> {
    const [found] = await this.withAvailability(
      this.baseQuery(manager).where('concert.id = CAST(:id AS INTEGER)', {
        id: String(id),
      }),
    );
    return found ?? null;
  }

  async create(data: NewConcert): Promise<ConcertWithAvailability> {
    const saved = await this.concerts.save(this.concerts.create(data));
    const created = await this.findById(saved.id);
    if (created === null) {
      throw new Error(`El concierto ${saved.id} no se pudo releer`);
    }
    return created;
  }

  private baseQuery(manager?: EntityManager): SelectQueryBuilder<Concert> {
    const repository = manager?.getRepository(Concert) ?? this.concerts;
    return repository
      .createQueryBuilder('concert')
      .leftJoinAndSelect('concert.artist', 'artist')
      .addSelect(AVAILABLE_SQL, 'available');
  }

  private async withAvailability(
    query: SelectQueryBuilder<Concert>,
  ): Promise<ConcertWithAvailability[]> {
    const { entities, raw } = await query.getRawAndEntities<{
      available: number | string;
    }>();
    // Relación muchos-a-uno: una fila por concierto, en el mismo orden.
    return entities.map((concert, index) => ({
      concert,
      available: Number(raw[index].available),
    }));
  }
}
