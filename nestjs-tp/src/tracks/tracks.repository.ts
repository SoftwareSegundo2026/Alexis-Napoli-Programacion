import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
