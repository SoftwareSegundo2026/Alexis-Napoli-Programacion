import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ArtistsRepository } from './artists.repository.js';
import { ArtistsService } from './artists.service.js';
import { Artist } from './entities/artist.entity.js';

function artist(
  id: number,
  name: string | null,
  imageUrl: string | null = null,
): Artist {
  return Object.assign(new Artist(), { id, name, imageUrl });
}

describe('ArtistsService', () => {
  let service: ArtistsService;
  const repository = {
    findPage: vi.fn(),
    findById: vi.fn(),
    existsWithName: vi.fn(),
    countAlbums: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    repository.save.mockImplementation((value: Artist) =>
      Promise.resolve(value),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistsService,
        { provide: ArtistsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(ArtistsService);
  });

  it('findAll pide la página al repository (RF-1, RF-2)', async () => {
    repository.findPage.mockResolvedValue([]);

    await service.findAll({ skip: 5, limit: 10 });

    expect(repository.findPage).toHaveBeenCalledWith(5, 10);
  });

  it('findOne → 404 "Artist not found" si no existe (RF-3)', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(
      new NotFoundException('Artist not found'),
    );
  });

  describe('create (RF-6, RF-13)', () => {
    it('guarda nombre e imagen (la imagen es opcional)', async () => {
      repository.existsWithName.mockResolvedValue(false);
      repository.create.mockResolvedValue(artist(278, 'Soda Stereo'));

      await service.create({ Name: 'Soda Stereo' });
      await service.create({ Name: 'Charly', ImageUrl: '/img/charly.jpg' });

      expect(repository.create).toHaveBeenNthCalledWith(1, {
        name: 'Soda Stereo',
        imageUrl: null,
      });
      expect(repository.create).toHaveBeenNthCalledWith(2, {
        name: 'Charly',
        imageUrl: '/img/charly.jpg',
      });
    });

    it('409 si el nombre ya existe, y no guarda nada', async () => {
      repository.existsWithName.mockResolvedValue(true);

      await expect(service.create({ Name: 'ac/dc' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update (RF-7, RF-13)', () => {
    it('cambia solo los campos enviados', async () => {
      repository.findById.mockResolvedValue(artist(1, 'AC/DC', '/img/1.jpg'));

      await expect(
        service.update(1, { ImageUrl: '/img/nueva.jpg' }),
      ).resolves.toEqual(artist(1, 'AC/DC', '/img/nueva.jpg'));
      expect(repository.existsWithName).not.toHaveBeenCalled();
    });

    it('ImageUrl en null borra la imagen (es un campo opcional)', async () => {
      repository.findById.mockResolvedValue(artist(1, 'AC/DC', '/img/1.jpg'));

      await expect(service.update(1, { ImageUrl: null })).resolves.toEqual(
        artist(1, 'AC/DC', null),
      );
    });

    it('renombrar comprueba el nombre excluyendo al propio artista', async () => {
      repository.findById.mockResolvedValue(artist(1, 'AC/DC'));
      repository.existsWithName.mockResolvedValue(false);

      await service.update(1, { Name: 'AC/DC' });

      expect(repository.existsWithName).toHaveBeenCalledWith('AC/DC', 1);
    });

    it('409 si el nombre es de OTRO artista, y no guarda nada', async () => {
      repository.findById.mockResolvedValue(artist(1, 'AC/DC'));
      repository.existsWithName.mockResolvedValue(true);

      await expect(
        service.update(1, { Name: 'Accept' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('404 si el artista no existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(999, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remove (RF-8, RF-12)', () => {
    it('borra un artista sin álbumes', async () => {
      repository.findById.mockResolvedValue(artist(278, 'Nuevo'));
      repository.countAlbums.mockResolvedValue(0);

      await service.remove(278);

      expect(repository.delete).toHaveBeenCalledWith(278);
    });

    it('409 si tiene álbumes, y no borra nada', async () => {
      repository.findById.mockResolvedValue(artist(1, 'AC/DC'));
      repository.countAlbums.mockResolvedValue(2);

      await expect(service.remove(1)).rejects.toThrow(/2 album/);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('404 si no existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
