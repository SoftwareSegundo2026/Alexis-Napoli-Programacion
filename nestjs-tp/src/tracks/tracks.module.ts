import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlbumsModule } from '../albums/albums.module.js';
import { GenresModule } from '../genres/genres.module.js';
import { InvoiceLine } from './entities/invoice-line.entity.js';
import { MediaType } from './entities/media-type.entity.js';
import { PlaylistTrack } from './entities/playlist-track.entity.js';
import { Track } from './entities/track.entity.js';
import { TracksController } from './tracks.controller.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Track, MediaType, InvoiceLine, PlaylistTrack]),
    // Exportan sus repositories: el service valida que AlbumId y GenreId existan.
    AlbumsModule,
    GenresModule,
  ],
  controllers: [TracksController],
  providers: [TracksService, TracksRepository],
})
export class TracksModule {}
