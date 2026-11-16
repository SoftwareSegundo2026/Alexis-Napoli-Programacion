import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AlbumsRepository } from '../albums/albums.repository.js';
import { GenresRepository } from '../genres/genres.repository.js';
import { CreateTrackDto } from './dto/create-track.dto.js';
import { SearchTracksQueryDto } from './dto/search-tracks-query.dto.js';
import { Track } from './entities/track.entity.js';
import { TracksRepository } from './tracks.repository.js';
import { TracksService } from './tracks.service.js';

function track(overrides: Partial<Track> = {}): Track {
  return Object.assign(
    new Track(),
    {
      id: 1,
      name: 'Pista',
      albumId: 1,
      mediaTypeId: 1,
      genreId: 1,
      composer: null,
      milliseconds: 1000,
      bytes: 10,
      unitPrice: 0.99,
    },
    overrides,
  );
}

const validCreate = {
  Name: 'Nueva',
  MediaTypeId: 1,
  Milliseconds: 200000,
  UnitPrice: 0.99,
} satisfies CreateTrackDto;

describe('TracksService', () => {
  let service: TracksService;
  const tracks = {
    findPage: vi.fn(),
    findById: vi.fn(),
    mediaTypeExists: vi.fn(),
    countReferences: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
  };
  const albums = { findById: vi.fn() };
  const genres = { findById: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    tracks.mediaTypeExists.mockResolvedValue(true);
    albums.findById.mockResolvedValue({ id: 1 });
    genres.findById.mockResolvedValue({ id: 1 });
    tracks.save.mockImplementation((value: Track) => Promise.resolve(value));
    const moduleRef = await Test.createTestingModule({
      providers: [
        TracksService,
        { provide: TracksRepository, useValue: tracks },
        { provide: AlbumsRepository, useValue: albums },
        { provide: GenresRepository, useValue: genres },
      ],
    }).compile();
    service = moduleRef.get(TracksService);
  });

  it('findAll pide la página al repository (RF-1, RF-2)', async () => {
    tracks.findPage.mockResolvedValue([]);

    await service.findAll({ skip: 100, limit: 50 });

    expect(tracks.findPage).toHaveBeenCalledWith(100, 50);
  });

  it('findOne → 404 "Track not found" si no existe (RF-3)', async () => {
    tracks.findById.mockResolvedValue(null);

    await expect(service.findOne(9999)).rejects.toThrow(
      new NotFoundException('Track not found'),
    );
  });

  describe('create (RF-6, RF-9)', () => {
    it('sin álbum ni género los guarda en null; solo valida el tipo de medio', async () => {
      tracks.create.mockResolvedValue(track());

      await service.create(validCreate);

      expect(albums.findById).not.toHaveBeenCalled();
      expect(genres.findById).not.toHaveBeenCalled();
      expect(tracks.create).toHaveBeenCalledWith({
        name: 'Nueva',
        albumId: null,
        mediaTypeId: 1,
        genreId: null,
        composer: null,
        milliseconds: 200000,
        bytes: null,
        unitPrice: 0.99,
      });
    });

    it.each([
      ['MediaTypeId', () => tracks.mediaTypeExists.mockResolvedValue(false)],
      ['AlbumId', () => albums.findById.mockResolvedValue(null)],
      ['GenreId', () => genres.findById.mockResolvedValue(null)],
    ])(
      '%s inexistente → 400 que lo nombra, sin guardar',
      async (field, arrange) => {
        arrange();

        const result = service.create({
          ...validCreate,
          AlbumId: 1,
          GenreId: 1,
        });

        await expect(result).rejects.toBeInstanceOf(BadRequestException);
        await expect(result).rejects.toThrow(new RegExp(field));
        expect(tracks.create).not.toHaveBeenCalled();
      },
    );
  });

  describe('update (RF-7, RF-9)', () => {
    it('cambia solo los campos enviados', async () => {
      tracks.findById.mockResolvedValue(track());

      await expect(
        service.update(1, { UnitPrice: 1.99, Composer: 'Alguien' }),
      ).resolves.toEqual(track({ unitPrice: 1.99, composer: 'Alguien' }));
      expect(tracks.mediaTypeExists).not.toHaveBeenCalled();
    });

    it('AlbumId y GenreId en null quitan la relación sin validarla', async () => {
      tracks.findById.mockResolvedValue(track());

      await expect(
        service.update(1, { AlbumId: null, GenreId: null }),
      ).resolves.toEqual(track({ albumId: null, genreId: null }));
      expect(albums.findById).not.toHaveBeenCalled();
    });

    it('un id relacionado nuevo e inexistente → 400 y no guarda', async () => {
      tracks.findById.mockResolvedValue(track());
      genres.findById.mockResolvedValue(null);

      await expect(service.update(1, { GenreId: 999 })).rejects.toThrow(
        /GenreId/,
      );
      expect(tracks.save).not.toHaveBeenCalled();
    });

    it('404 si la pista no existe', async () => {
      tracks.findById.mockResolvedValue(null);

      await expect(service.update(9999, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove (RF-8, RF-12)', () => {
    it('borra una pista sin facturas ni playlists', async () => {
      tracks.findById.mockResolvedValue(track({ id: 3504 }));
      tracks.countReferences.mockResolvedValue({
        invoiceLines: 0,
        playlists: 0,
      });

      await service.remove(3504);

      expect(tracks.delete).toHaveBeenCalledWith(3504);
    });

    it.each([
      [{ invoiceLines: 1, playlists: 0 }, /invoice/],
      [{ invoiceLines: 0, playlists: 3 }, /playlist/],
    ])(
      'referenciada %j → 409 que explica la causa',
      async (references, cause) => {
        tracks.findById.mockResolvedValue(track());
        tracks.countReferences.mockResolvedValue(references);

        const result = service.remove(1);

        await expect(result).rejects.toBeInstanceOf(ConflictException);
        await expect(result).rejects.toThrow(cause);
        expect(tracks.delete).not.toHaveBeenCalled();
      },
    );
  });

  describe('search (spec 003 RF-6)', () => {
    const query = Object.assign(new SearchTracksQueryDto(), {
      q: 'love',
      genreId: 1,
      skip: 0,
      limit: 2,
    });

    it('pasa los filtros al repository y arma la página con hasMore', async () => {
      const found = [track({ id: 1 }), track({ id: 2 })];
      tracks.search.mockResolvedValue({ items: found, total: 5 });

      const page = await service.search(query);

      expect(tracks.search).toHaveBeenCalledWith(query);
      expect(page).toEqual({
        items: found,
        total: 5,
        skip: 0,
        limit: 2,
        hasMore: true,
      });
    });

    it('sin resultados → página vacía y hasMore false (RF-7)', async () => {
      tracks.search.mockResolvedValue({ items: [], total: 0 });

      await expect(service.search(query)).resolves.toEqual({
        items: [],
        total: 0,
        skip: 0,
        limit: 2,
        hasMore: false,
      });
    });
  });
});
