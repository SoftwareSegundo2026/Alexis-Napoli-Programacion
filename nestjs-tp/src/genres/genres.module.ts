import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Genre } from './entities/genre.entity.js';
import { GenresController } from './genres.controller.js';
import { GenresRepository } from './genres.repository.js';
import { GenresService } from './genres.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Genre])],
  controllers: [GenresController],
  providers: [GenresService, GenresRepository],
  // Pistas lo usa para validar que el GenreId exista (RF-9).
  exports: [GenresRepository],
})
export class GenresModule {}
