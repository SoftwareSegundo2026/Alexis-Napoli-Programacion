import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistsController } from './artists.controller.js';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';
import { Artist } from './entities/artist.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Artist])],
  controllers: [ArtistsController],
  providers: [ArtistsService, ArtistsRepository],
  // Álbumes lo usa para validar que el ArtistId exista (RF-9).
  exports: [ArtistsRepository],
})
export class ArtistsModule {}
