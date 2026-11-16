import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto.js';
import { CreateGenreDto } from './dto/create-genre.dto.js';
import { UpdateGenreDto } from './dto/update-genre.dto.js';
import { Genre } from './entities/genre.entity.js';
import { GenresRepository } from './genres.repository.js';

/** Reglas de negocio de géneros: 404, nombre único (409) e integridad al borrar (409). */
@Injectable()
export class GenresService {
  constructor(private readonly repository: GenresRepository) {}

  findAll({ skip, limit }: PaginationQueryDto): Promise<Genre[]> {
    return this.repository.findPage(skip, limit);
  }

  async findOne(id: number): Promise<Genre> {
    const genre = await this.repository.findById(id);
    if (genre === null) {
      throw new NotFoundException('Genre not found');
    }
    return genre;
  }

  async create(dto: CreateGenreDto): Promise<Genre> {
    await this.ensureNameIsFree(dto.Name);
    return this.repository.create({ name: dto.Name });
  }

  /** Modificación parcial: solo cambia lo que vino en el cuerpo (RF-7). */
  async update(id: number, dto: UpdateGenreDto): Promise<Genre> {
    const genre = await this.findOne(id);
    if (dto.Name !== undefined) {
      await this.ensureNameIsFree(dto.Name, id);
      genre.name = dto.Name;
    }
    return this.repository.save(genre);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    const tracks = await this.repository.countTracks(id);
    if (tracks > 0) {
      throw new ConflictException(
        `Genre is used by ${tracks} track(s) and cannot be deleted`,
      );
    }
    await this.repository.delete(id);
  }

  /** RF-13: el nombre no puede ser el de OTRO género. */
  private async ensureNameIsFree(name: string, ownId?: number): Promise<void> {
    if (await this.repository.existsWithName(name, ownId)) {
      throw new ConflictException(`A genre named "${name}" already exists`);
    }
  }
}
