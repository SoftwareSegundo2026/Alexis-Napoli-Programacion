import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ArtistsRepository } from '../artists/artists.repository.js';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { assignDefined } from '../common/patch/assign-defined.js';
import { AlbumsRepository } from './albums.repository.js';
import { CreateAlbumDto } from './dto/create-album.dto.js';
import { UpdateAlbumDto } from './dto/update-album.dto.js';
import { Album } from './entities/album.entity.js';

/** Reglas de negocio de álbumes: 404, artista existente (400) y no borrar si tiene pistas (409). */
@Injectable()
export class AlbumsService {
  constructor(
    private readonly albums: AlbumsRepository,
    private readonly artists: ArtistsRepository,
  ) {}

  findAll({ skip, limit }: PaginationQueryDto): Promise<Album[]> {
    return this.albums.findPage(skip, limit);
  }

  async findOne(id: number): Promise<Album> {
    const album = await this.albums.findById(id);
    if (album === null) {
      throw new NotFoundException('Album not found');
    }
    return album;
  }

  async create(dto: CreateAlbumDto): Promise<Album> {
    await this.ensureArtistExists(dto.ArtistId);
    return this.albums.create({
      title: dto.Title,
      artistId: dto.ArtistId,
      imageUrl: dto.ImageUrl ?? null,
    });
  }

  /** Modificación parcial: solo cambia lo que vino en el cuerpo (RF-7). */
  async update(id: number, dto: UpdateAlbumDto): Promise<Album> {
    const album = await this.findOne(id);
    if (dto.ArtistId !== undefined) {
      await this.ensureArtistExists(dto.ArtistId);
    }
    assignDefined(album, {
      artistId: dto.ArtistId,
      title: dto.Title,
      imageUrl: dto.ImageUrl,
    });
    return this.albums.save(album);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const tracks = await this.albums.countTracks(id);
    if (tracks > 0) {
      throw new ConflictException(
        `Album has ${tracks} track(s) and cannot be deleted`,
      );
    }
    await this.albums.delete(id);
  }

  /**
   * Un `ArtistId` inexistente es un dato inválido del cuerpo → 400, no 404:
   * el recurso que se pidió es el álbum (casos límite de la spec).
   */
  private async ensureArtistExists(artistId: number): Promise<void> {
    if ((await this.artists.findById(artistId)) === null) {
      throw new BadRequestException(
        `ArtistId ${artistId} does not match any artist`,
      );
    }
  }
}
