import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistsModule } from '../artists/artists.module.js';
import { ConcertsController } from './concerts.controller.js';
import { ConcertsRepository } from './concerts.repository.js';
import { ConcertsService } from './concerts.service.js';
import { Concert } from './entities/concert.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Concert]), ArtistsModule],
  controllers: [ConcertsController],
  providers: [ConcertsService, ConcertsRepository],
  // Reservas lo usa para leer el concierto y su disponibilidad (spec 004).
  exports: [ConcertsRepository],
})
export class ConcertsModule {}
