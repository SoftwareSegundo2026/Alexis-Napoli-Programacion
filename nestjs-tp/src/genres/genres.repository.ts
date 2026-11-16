import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unicodeLower } from '../database/sql-functions.js';
import { Genre } from './entities/genre.entity.js';

/** Datos de un género nuevo (sin id: lo asigna la base). */
export interface NewGenre {
  name: string;
}

/**
 * DAO de géneros: el ÚNICO lugar que habla con la base para este recurso.
 * El service no conoce TypeORM, así que en sus tests se reemplaza por un mock.
 */
@Injectable()
export class GenresRepository {
  constructor(
    @InjectRepository(Genre) private readonly genres: Repository<Genre>,
  ) {}

  /** Una página, resuelta por la base con LIMIT/OFFSET (RNF-1). */
  findPage(skip: number, limit: number): Promise<Genre[]> {
    return this.genres.find({ skip, take: limit, order: { id: 'ASC' } });
  }

  findById(id: number): Promise<Genre | null> {
    return this.genres.findOneBy({ id });
  }

  /**
   * ¿Otro género ya usa este nombre? Sin distinguir mayúsculas ni los espacios
   * de los extremos (RF-13). `excludeId` deja afuera al propio registro.
   * Usa `unicode_lower` y no `LOWER()`, que solo normaliza A–Z (spec 005 RF-7).
   */
  existsWithName(name: string, excludeId?: number): Promise<boolean> {
    const query = this.genres
      .createQueryBuilder('genre')
      .where('unicode_lower(TRIM(genre.name)) = :name', {
        name: unicodeLower(name.trim()),
      });
    if (excludeId !== undefined) {
      query.andWhere('genre.id <> :excludeId', { excludeId });
    }
    return query.getExists();
  }

  /** Cantidad de pistas que usan el género (RF-12). */
  async countTracks(genreId: number): Promise<number> {
    const rows: Array<{ total: number }> = await this.genres.manager.query(
      'SELECT COUNT(*) AS total FROM Track WHERE GenreId = ?',
      [genreId],
    );
    return rows[0]?.total ?? 0;
  }

  create(data: NewGenre): Promise<Genre> {
    return this.genres.save(this.genres.create(data));
  }

  save(genre: Genre): Promise<Genre> {
    return this.genres.save(genre);
  }

  async delete(id: number): Promise<void> {
    await this.genres.delete({ id });
  }
}
