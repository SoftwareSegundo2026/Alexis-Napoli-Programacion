import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from './entities/album.entity.js';

/** Datos de un álbum nuevo (sin id: lo asigna la base). */
export interface NewAlbum {
  title: string;
  artistId: number;
  imageUrl: string | null;
}

/** DAO de álbumes: el único lugar que habla con la base para este recurso. */
@Injectable()
export class AlbumsRepository {
  constructor(
    @InjectRepository(Album) private readonly albums: Repository<Album>,
  ) {}

  /** Una página con el artista unido en la misma consulta (RNF-1, RF-4). */
  findPage(skip: number, limit: number): Promise<Album[]> {
    return this.albums.find({
      skip,
      take: limit,
      order: { id: 'ASC' },
      relations: { artist: true },
    });
  }

  findById(id: number): Promise<Album | null> {
    return this.albums.findOne({ where: { id }, relations: { artist: true } });
  }

  /** Cantidad de pistas del álbum (RF-12). */
  async countTracks(albumId: number): Promise<number> {
    const rows: Array<{ total: number }> = await this.albums.manager.query(
      'SELECT COUNT(*) AS total FROM Track WHERE AlbumId = ?',
      [albumId],
    );
    return rows[0]?.total ?? 0;
  }

  /** Guarda y relee con el artista, para devolver `ArtistName` (RF-6). */
  async create(data: NewAlbum): Promise<Album> {
    const saved = await this.albums.save(this.albums.create(data));
    return this.reload(saved.id);
  }

  /** Guarda y relee: si cambió `ArtistId`, el `ArtistName` tiene que ser el nuevo. */
  async save(album: Album): Promise<Album> {
    const { id, title, artistId, imageUrl } = album;
    await this.albums.save({ id, title, artistId, imageUrl });
    return this.reload(id);
  }

  async delete(id: number): Promise<void> {
    await this.albums.delete({ id });
  }

  private async reload(id: number): Promise<Album> {
    return this.albums.findOneOrFail({
      where: { id },
      relations: { artist: true },
    });
  }
}
