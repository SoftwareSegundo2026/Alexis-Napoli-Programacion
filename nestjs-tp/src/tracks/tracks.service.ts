import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlbumsRepository } from '../albums/albums.repository.js';
import { toPage, type Page } from '../common/dto/page.dto.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { assignDefined } from '../common/patch/assign-defined.js';
import { GenresRepository } from '../genres/genres.repository.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { SearchTracksQueryDto } from './dto/search-tracks-query.dto.js';
import { UpdateTrackDto } from './dto/update-track.dto.js';
import { Track } from './entities/track.entity.js';
import { TracksRepository } from './tracks.repository.js';

/** Ids relacionados que puede traer un alta o una modificación. */
interface RelatedIds {
  AlbumId?: number | null;
  MediaTypeId?: number;
  GenreId?: number | null;
}

/**
 * Reglas de negocio de pistas: 404, ids relacionados existentes (400) y no
 * borrar una pista que está en facturas o playlists (409).
 */
@Injectable()
export class TracksService {
  constructor(
    private readonly tracks: TracksRepository,
    private readonly albums: AlbumsRepository,
    private readonly genres: GenresRepository,
  ) {}

  findAll({ skip, limit }: PaginationQueryDto): Promise<Track[]> {
    return this.tracks.findPage(skip, limit);
  }

  /**
   * Búsqueda con filtros combinados (spec 003). Los filtros ya vienen validados
   * por el DTO (RF-9); el repository resuelve todo en la base y acá se arma la
   * página con los metadatos (RF-6).
   */
  async search(query: SearchTracksQueryDto): Promise<Page<Track>> {
    const { items, total } = await this.tracks.search(query);
    return toPage(items, total, query.skip, query.limit);
  }

  async findOne(id: number): Promise<Track> {
    const track = await this.tracks.findById(id);
    if (track === null) {
      throw new NotFoundException('Track not found');
    }
    return track;
  }

  async create(dto: CreateTrackDto): Promise<Track> {
    await this.ensureRelatedExist(dto);
    return this.tracks.create({
      name: dto.Name,
      albumId: dto.AlbumId ?? null,
      mediaTypeId: dto.MediaTypeId,
      genreId: dto.GenreId ?? null,
      composer: dto.Composer ?? null,
      milliseconds: dto.Milliseconds,
      bytes: dto.Bytes ?? null,
      unitPrice: dto.UnitPrice,
    });
  }

  /** Modificación parcial: solo cambia lo que vino en el cuerpo (RF-7). */
  async update(id: number, dto: UpdateTrackDto): Promise<Track> {
    const track = await this.findOne(id);
    await this.ensureRelatedExist(dto);

    assignDefined(track, {
      name: dto.Name,
      albumId: dto.AlbumId,
      mediaTypeId: dto.MediaTypeId,
      genreId: dto.GenreId,
      composer: dto.Composer,
      milliseconds: dto.Milliseconds,
      bytes: dto.Bytes,
      unitPrice: dto.UnitPrice,
    });
    return this.tracks.save(track);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const { invoiceLines, playlists } = await this.tracks.countReferences(id);
    if (invoiceLines > 0 || playlists > 0) {
      throw new ConflictException(
        `Track is referenced by ${invoiceLines} invoice line(s) and ` +
          `${playlists} playlist(s) and cannot be deleted`,
      );
    }
    await this.tracks.delete(id);
  }

  /**
   * Los ids relacionados que vienen (y no son `null`) tienen que existir, tanto
   * en el alta como en la modificación. Si no → 400 que nombra el campo: es un
   * dato inválido del cuerpo, no un 404 (el recurso pedido es la pista).
   */
  private async ensureRelatedExist(ids: RelatedIds): Promise<void> {
    const { MediaTypeId, AlbumId, GenreId } = ids;
    if (
      MediaTypeId !== undefined &&
      !(await this.tracks.mediaTypeExists(MediaTypeId))
    ) {
      throw invalidReference('MediaTypeId', MediaTypeId, 'media type');
    }
    if (
      AlbumId !== undefined &&
      AlbumId !== null &&
      (await this.albums.findById(AlbumId)) === null
    ) {
      throw invalidReference('AlbumId', AlbumId, 'album');
    }
    if (
      GenreId !== undefined &&
      GenreId !== null &&
      (await this.genres.findById(GenreId)) === null
    ) {
      throw invalidReference('GenreId', GenreId, 'genre');
    }
  }
}

function invalidReference(
  field: string,
  id: number,
  resource: string,
): BadRequestException {
  return new BadRequestException(
    `${field} ${id} does not match any ${resource}`,
  );
}
