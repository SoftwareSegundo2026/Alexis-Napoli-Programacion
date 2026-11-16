import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { assignDefined } from '../common/patch/assign-defined.js';
import { ArtistsRepository } from './artists.repository.js';
import { CreateArtistDto } from './dto/create-artist.dto.js';
import { UpdateArtistDto } from './dto/update-artist.dto.js';
import { Artist } from './entities/artist.entity.js';

/** Reglas de negocio de artistas: 404, nombre único (409) y no borrar si tiene álbumes (409). */
@Injectable()
export class ArtistsService {
  constructor(private readonly repository: ArtistsRepository) {}

  findAll({ skip, limit }: PaginationQueryDto): Promise<Artist[]> {
    return this.repository.findPage(skip, limit);
  }

  async findOne(id: number): Promise<Artist> {
    const artist = await this.repository.findById(id);
    if (artist === null) {
      throw new NotFoundException('Artist not found');
    }
    return artist;
  }

  async create(dto: CreateArtistDto): Promise<Artist> {
    await this.ensureNameIsFree(dto.Name);
    return this.repository.create({
      name: dto.Name,
      imageUrl: dto.ImageUrl ?? null,
    });
  }

  /** Modificación parcial: solo cambia lo que vino en el cuerpo (RF-7). */
  async update(id: number, dto: UpdateArtistDto): Promise<Artist> {
    const artist = await this.findOne(id);
    if (dto.Name !== undefined) {
      await this.ensureNameIsFree(dto.Name, id);
    }
    assignDefined(artist, { name: dto.Name, imageUrl: dto.ImageUrl });
    return this.repository.save(artist);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const albums = await this.repository.countAlbums(id);
    if (albums > 0) {
      throw new ConflictException(
        `Artist has ${albums} album(s) and cannot be deleted`,
      );
    }
    // Spec 004 RF-14: un concierto (con reservas pagas) no puede quedar huérfano.
    const concerts = await this.repository.countConcerts(id);
    if (concerts > 0) {
      throw new ConflictException(
        `Artist has ${concerts} concert(s) and cannot be deleted`,
      );
    }
    await this.repository.delete(id);
  }

  /** RF-13: el nombre no puede ser el de OTRO artista. */
  private async ensureNameIsFree(name: string, ownId?: number): Promise<void> {
    if (await this.repository.existsWithName(name, ownId)) {
      throw new ConflictException(`An artist named "${name}" already exists`);
    }
  }
}
