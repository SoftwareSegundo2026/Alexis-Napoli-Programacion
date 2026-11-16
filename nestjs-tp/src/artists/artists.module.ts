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
})
export class ArtistsModule {}
