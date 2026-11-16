import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ArtistsModule } from '../artists/artists.module.js';
import { AlbumsController } from './albums.controller.js';
import { AlbumsRepository } from './albums.repository.js';
import { AlbumsService } from './albums.service.js';
import { Album } from './entities/album.entity.js';

@Module({
  // ArtistsModule exporta su repository: el service valida que el ArtistId exista.
  imports: [TypeOrmModule.forFeature([Album]), ArtistsModule],
  controllers: [AlbumsController],
  providers: [AlbumsService, AlbumsRepository],
  // Pistas lo usa para validar que el AlbumId exista (RF-9).
  exports: [AlbumsRepository],
})
export class AlbumsModule {}
