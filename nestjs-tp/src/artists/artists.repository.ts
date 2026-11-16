import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unicodeLower } from '../database/sql-functions.js';
import { Artist } from './entities/artist.entity.js';

/** Datos de un artista nuevo (sin id: lo asigna la base). */
export interface NewArtist {
  name: string;
  imageUrl: string | null;
}

/** DAO de artistas: el único lugar que habla con la base para este recurso. */
@Injectable()
export class ArtistsRepository {
  constructor(
    @InjectRepository(Artist) private readonly artists: Repository<Artist>,
  ) {}

  /** Una página, resuelta por la base con LIMIT/OFFSET (RNF-1). */
  findPage(skip: number, limit: number): Promise<Artist[]> {
    return this.artists.find({ skip, take: limit, order: { id: 'ASC' } });
  }

  findById(id: number): Promise<Artist | null> {
    return this.artists.findOneBy({ id });
  }

  /**
   * ¿Otro artista ya usa este nombre? Sin distinguir mayúsculas ni espacios de
   * los extremos (RF-13); `excludeId` deja afuera al propio registro.
   * Usa `unicode_lower` y no `LOWER()`, que solo normaliza A–Z (spec 005 RF-7).
   */
  existsWithName(name: string, excludeId?: number): Promise<boolean> {
    const query = this.artists
      .createQueryBuilder('artist')
      .where('unicode_lower(TRIM(artist.name)) = :name', {
        name: unicodeLower(name.trim()),
      });
    if (excludeId !== undefined) {
      query.andWhere('artist.id <> :excludeId', { excludeId });
    }
    return query.getExists();
  }

  /** Cantidad de álbumes del artista (RF-12). */
  async countAlbums(artistId: number): Promise<number> {
    const rows: Array<{ total: number }> = await this.artists.manager.query(
      'SELECT COUNT(*) AS total FROM Album WHERE ArtistId = ?',
      [artistId],
    );
    return rows[0]?.total ?? 0;
  }

  create(data: NewArtist): Promise<Artist> {
    return this.artists.save(this.artists.create(data));
  }

  save(artist: Artist): Promise<Artist> {
    return this.artists.save(artist);
  }

  async delete(id: number): Promise<void> {
    await this.artists.delete({ id });
  }
}
