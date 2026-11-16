import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Genre } from './entities/genre.entity.js';
import { GenresRepository } from './genres.repository.js';
import { GenresService } from './genres.service.js';

function genre(id: number, name: string | null): Genre {
  return Object.assign(new Genre(), { id, name });
}

describe('GenresService', () => {
  let service: GenresService;
  const repository = {
    findPage: vi.fn(),
    findById: vi.fn(),
    existsWithName: vi.fn(),
    countTracks: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GenresService,
        { provide: GenresRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(GenresService);
  });

  describe('findAll (RF-1, RF-2)', () => {
    it('pide la página al repository con skip y limit', async () => {
      const page = [genre(3, 'Metal')];
      repository.findPage.mockResolvedValue(page);

      await expect(service.findAll({ skip: 2, limit: 1 })).resolves.toBe(page);
      expect(repository.findPage).toHaveBeenCalledWith(2, 1);
    });
  });

  describe('findOne (RF-3)', () => {
    it('devuelve el género si existe', async () => {
      repository.findById.mockResolvedValue(genre(1, 'Rock'));

      await expect(service.findOne(1)).resolves.toEqual(genre(1, 'Rock'));
    });

    it('404 "Genre not found" si no existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        new NotFoundException('Genre not found'),
      );
    });
  });

  describe('create (RF-6, RF-13)', () => {
    it('guarda el género si el nombre está libre', async () => {
      repository.existsWithName.mockResolvedValue(false);
      repository.create.mockResolvedValue(genre(26, 'Tango'));

      await expect(service.create({ Name: 'Tango' })).resolves.toEqual(
        genre(26, 'Tango'),
      );
      expect(repository.existsWithName).toHaveBeenCalledWith(
        'Tango',
        undefined,
      );
      expect(repository.create).toHaveBeenCalledWith({ name: 'Tango' });
    });

    it('409 si otro género ya tiene ese nombre, y no guarda nada', async () => {
      repository.existsWithName.mockResolvedValue(true);

      await expect(service.create({ Name: 'rock' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update (RF-7, RF-13)', () => {
    it('cambia solo los campos enviados', async () => {
      repository.findById.mockResolvedValue(genre(1, 'Rock'));
      repository.existsWithName.mockResolvedValue(false);
      repository.save.mockImplementation((value: Genre) =>
        Promise.resolve(value),
      );

      await expect(
        service.update(1, { Name: 'Rock Clásico' }),
      ).resolves.toEqual(genre(1, 'Rock Clásico'));
      expect(repository.existsWithName).toHaveBeenCalledWith('Rock Clásico', 1);
    });

    it('con un cuerpo vacío deja el género igual', async () => {
      repository.findById.mockResolvedValue(genre(1, 'Rock'));
      repository.save.mockImplementation((value: Genre) =>
        Promise.resolve(value),
      );

      await expect(service.update(1, {})).resolves.toEqual(genre(1, 'Rock'));
      expect(repository.existsWithName).not.toHaveBeenCalled();
    });

    it('404 si el género no existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.update(999, { Name: 'X' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('409 si el nombre nuevo es de OTRO género, y no guarda nada', async () => {
      repository.findById.mockResolvedValue(genre(1, 'Rock'));
      repository.existsWithName.mockResolvedValue(true);

      await expect(service.update(1, { Name: 'Jazz' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove (RF-8, RF-12)', () => {
    it('borra un género que ninguna pista usa', async () => {
      repository.findById.mockResolvedValue(genre(26, 'Tango'));
      repository.countTracks.mockResolvedValue(0);

      await service.remove(26);

      expect(repository.delete).toHaveBeenCalledWith(26);
    });

    it('409 si alguna pista lo usa, y no borra nada', async () => {
      repository.findById.mockResolvedValue(genre(1, 'Rock'));
      repository.countTracks.mockResolvedValue(1297);

      await expect(service.remove(1)).rejects.toThrow(/1297 track/);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('404 si el género no existe', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });
  });
});
