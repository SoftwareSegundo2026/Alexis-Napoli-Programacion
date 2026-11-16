import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { unicodeLower } from '../database/sql-functions.js';
import type {
  SortOrder,
  TrackSortField,
} from './dto/search-tracks-query.dto.js';
import { escapeLike } from './escape-like.js';
import { InvoiceLine } from './entities/invoice-line.entity.js';
import { MediaType } from './entities/media-type.entity.js';
import { PlaylistTrack } from './entities/playlist-track.entity.js';
import { Track } from './entities/track.entity.js';

/** Datos de una pista nueva (sin id: lo asigna la base). */
export interface NewTrack {
  name: string;
  albumId: number | null;
  mediaTypeId: number;
  genreId: number | null;
  composer: string | null;
  milliseconds: number;
  bytes: number | null;
  unitPrice: number;
}

/** Cuántas veces se usa una pista en otras tablas (RF-12). */
export interface TrackReferences {
  invoiceLines: number;
  playlists: number;
}

const WITH_NAMES = { album: true, genre: true, mediaType: true } as const;

/** Filtros, orden y página de una búsqueda (ya validados por el DTO, spec 003 RF-9). */
export interface TrackSearchFilters {
  q?: string;
  genreId?: number;
  artistId?: number;
  minPrice?: number;
  maxPrice?: number;
  minMs?: number;
  maxMs?: number;
  sort: TrackSortField;
  order: SortOrder;
  skip: number;
  limit: number;
}

/**
 * Expresión SQL de cada campo de orden (whitelist, spec 003 RF-5). El valor que
 * manda el cliente solo ELIGE una clave de este mapa: nunca llega al SQL.
 * `name` ordena sin distinguir mayúsculas, con la misma regla del texto (RF-5).
 */
const SORT_COLUMNS: Record<TrackSortField, string> = {
  trackId: 'track.id',
  name: 'unicode_lower(track.name)',
  unitPrice: 'track.unitPrice',
  milliseconds: 'track.milliseconds',
};

/** DAO de pistas: el único lugar que habla con la base para este recurso. */
@Injectable()
export class TracksRepository {
  constructor(
    @InjectRepository(Track) private readonly tracks: Repository<Track>,
    @InjectRepository(MediaType)
    private readonly mediaTypes: Repository<MediaType>,
    @InjectRepository(InvoiceLine)
    private readonly invoiceLines: Repository<InvoiceLine>,
    @InjectRepository(PlaylistTrack)
    private readonly playlistTracks: Repository<PlaylistTrack>,
  ) {}

  /** Una página con álbum, género y tipo de medio unidos en la consulta (RNF-1, RF-5). */
  findPage(skip: number, limit: number): Promise<Track[]> {
    return this.tracks.find({
      skip,
      take: limit,
      order: { id: 'ASC' },
      relations: WITH_NAMES,
    });
  }

  /**
   * Búsqueda con filtros combinados (spec 003). Todo se resuelve EN LA BASE: una
   * consulta con la página (LIMIT/OFFSET) y otra con el total (COUNT), RNF-1.
   * Todos los valores viajan como parámetros nombrados, nunca concatenados (RNF-3).
   * LEFT JOIN: una pista sin álbum o sin género no desaparece (RF-10).
   */
  async search(
    filters: TrackSearchFilters,
  ): Promise<{ items: Track[]; total: number }> {
    const query = this.tracks
      .createQueryBuilder('track')
      .leftJoinAndSelect('track.album', 'album')
      .leftJoinAndSelect('track.genre', 'genre')
      .leftJoinAndSelect('track.mediaType', 'mediaType');

    if (filters.q !== undefined) {
      // Contiene el texto, sin distinguir mayúsculas (RF-2) y con % y _ literales (RF-8).
      query.andWhere(
        "(unicode_lower(track.name) LIKE :q ESCAPE '\\' OR unicode_lower(track.composer) LIKE :q ESCAPE '\\')",
        { q: `%${escapeLike(String(unicodeLower(filters.q)))}%` },
      );
    }
    if (filters.genreId !== undefined) {
      query.andWhere('track.genreId = :genreId', { genreId: filters.genreId });
    }
    if (filters.artistId !== undefined) {
      // El artista es el del álbum: una pista sin álbum no coincide (RF-4).
      query.andWhere('album.artistId = :artistId', {
        artistId: filters.artistId,
      });
    }
    if (filters.minPrice !== undefined) {
      query.andWhere('track.unitPrice >= :minPrice', {
        minPrice: filters.minPrice,
      });
    }
    if (filters.maxPrice !== undefined) {
      query.andWhere('track.unitPrice <= :maxPrice', {
        maxPrice: filters.maxPrice,
      });
    }
    if (filters.minMs !== undefined) {
      query.andWhere('track.milliseconds >= :minMs', { minMs: filters.minMs });
    }
    if (filters.maxMs !== undefined) {
      query.andWhere('track.milliseconds <= :maxMs', { maxMs: filters.maxMs });
    }

    query.orderBy(
      SORT_COLUMNS[filters.sort],
      filters.order === 'desc' ? 'DESC' : 'ASC',
    );
    // Desempate fijo por id: páginas estables, sin repetidos ni huecos (RF-5).
    // Solo si el orden no ES ya por id: TypeORM guarda el orden por columna, y un
    // segundo "track.id ASC" pisaría a un "track.id DESC" pedido por el cliente.
    if (filters.sort !== 'trackId') {
      query.addOrderBy('track.id', 'ASC');
    }

    const [items, total] = await query
      .offset(filters.skip)
      .limit(filters.limit)
      .getManyAndCount();
    return { items, total };
  }

  findById(id: number): Promise<Track | null> {
    return this.tracks.findOne({ where: { id }, relations: WITH_NAMES });
  }

  mediaTypeExists(id: number): Promise<boolean> {
    return this.mediaTypes.existsBy({ id });
  }

  async countReferences(trackId: number): Promise<TrackReferences> {
    const [invoiceLines, playlists] = await Promise.all([
      this.invoiceLines.countBy({ trackId }),
      this.playlistTracks.countBy({ trackId }),
    ]);
    return { invoiceLines, playlists };
  }

  /** Guarda y relee con las relaciones, para devolver los nombres derivados. */
  async create(data: NewTrack): Promise<Track> {
    const saved = await this.tracks.save(this.tracks.create(data));
    return this.reload(saved.id);
  }

  /** Guarda solo las columnas propias y relee (si cambió un id, cambia su nombre). */
  async save(track: Track): Promise<Track> {
    const { id, name, albumId, mediaTypeId, genreId } = track;
    const { composer, milliseconds, bytes, unitPrice } = track;
    await this.tracks.save({
      id,
      name,
      albumId,
      mediaTypeId,
      genreId,
      composer,
      milliseconds,
      bytes,
      unitPrice,
    });
    return this.reload(id);
  }

  async delete(id: number): Promise<void> {
    await this.tracks.delete({ id });
  }

  private reload(id: number): Promise<Track> {
    return this.tracks.findOneOrFail({ where: { id }, relations: WITH_NAMES });
  }
}
