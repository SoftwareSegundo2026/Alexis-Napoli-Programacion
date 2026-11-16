import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ArtistsRepository } from '../artists/artists.repository.js';
import { Artist } from '../artists/entities/artist.entity.js';
import { AlbumsRepository } from './albums.repository.js';
import { AlbumsService } from './albums.service.js';
import { Album } from './entities/album.entity.js';

function album(id: number, title: string, artistId: number): Album {
  return Object.assign(new Album(), {
    id,
    title,
    artistId,
    imageUrl: null,
  });
}

const someArtist = Object.assign(new Artist(), { id: 1, name: 'AC/DC' });

describe('AlbumsService', () => {
  let service: AlbumsService;
  const albums = {
    findPage: vi.fn(),
    findById: vi.fn(),
    countTracks: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const artists = { findById: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    albums.save.mockImplementation((value: Album) => Promise.resolve(value));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlbumsService,
        { provide: AlbumsRepository, useValue: albums },
        { provide: ArtistsRepository, useValue: artists },
      ],
    }).compile();

    service = module.get<AlbumsService>(AlbumsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAll pide la página al repository (RF-1, RF-2)', async () => {
    albums.findPage.mockResolvedValue([]);

    await service.findAll({ skip: 0, limit: 20 });

    expect(albums.findPage).toHaveBeenCalledWith(0, 20);
  });

  it('findOne → 404 "Album not found" si no existe (RF-3)', async () => {
    albums.findById.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(
      new NotFoundException('Album not found'),
    );
  });

  describe('create (RF-6, RF-9)', () => {
    it('con un ArtistId existente guarda y devuelve el álbum con su artista', async () => {
      artists.findById.mockResolvedValue(someArtist);
      albums.create.mockResolvedValue(album(349, 'Nuevo', 1));

      await service.create({ Title: 'Nuevo', ArtistId: 1 });

      expect(albums.create).toHaveBeenCalledWith({
        title: 'Nuevo',
        artistId: 1,
        imageUrl: null,
      });
    });

    it('ArtistId inexistente → 400 (no 404: el recurso pedido es el álbum)', async () => {
      artists.findById.mockResolvedValue(null);

      const result = service.create({ Title: 'Nuevo', ArtistId: 9999 });

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/ArtistId/);
      expect(albums.create).not.toHaveBeenCalled();
    });
  });

  describe('update (RF-7, RF-9)', () => {
    it('cambia solo los campos enviados', async () => {
      albums.findById.mockResolvedValue(album(1, 'Viejo', 1));

      await expect(service.update(1, { Title: 'Nuevo' })).resolves.toEqual(
        album(1, 'Nuevo', 1),
      );
      expect(artists.findById).not.toHaveBeenCalled();
    });

    it('también valida que el ArtistId nuevo exista → 400 y no guarda', async () => {
      albums.findById.mockResolvedValue(album(1, 'Viejo', 1));
      artists.findById.mockResolvedValue(null);

      await expect(
        service.update(1, { ArtistId: 9999 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(albums.save).not.toHaveBeenCalled();
    });

    it('404 si el álbum no existe', async () => {
      albums.findById.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove (RF-8, RF-12)', () => {
    it('borra un álbum sin pistas', async () => {
      albums.findById.mockResolvedValue(album(349, 'Nuevo', 1));
      albums.countTracks.mockResolvedValue(0);

      await service.remove(349);

      expect(albums.delete).toHaveBeenCalledWith(349);
    });

    it('409 si tiene pistas, y no borra nada', async () => {
      albums.findById.mockResolvedValue(album(1, 'Viejo', 1));
      albums.countTracks.mockResolvedValue(10);

      await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
      expect(albums.delete).not.toHaveBeenCalled();
    });
  });
});
