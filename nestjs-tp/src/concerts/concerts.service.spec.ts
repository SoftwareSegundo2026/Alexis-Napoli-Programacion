import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ArtistsRepository } from '../artists/artists.repository.js';
import { Clock } from '../database/clock.js';
import { ConcertsRepository } from './concerts.repository.js';
import { ConcertsService } from './concerts.service.js';
import { CreateConcertDto } from './dto/create-concert.dto.js';
import { Concert } from './entities/concert.entity.js';

const NOW = new Date('2030-01-01T00:00:00Z');

describe('ConcertsService (spec 004 RF-1)', () => {
  const concerts = { findPage: vi.fn(), findById: vi.fn(), create: vi.fn() };
  const artists = { findById: vi.fn() };
  const clock = { now: () => NOW };
  let service: ConcertsService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConcertsService,
        { provide: ConcertsRepository, useValue: concerts },
        { provide: ArtistsRepository, useValue: artists },
        { provide: Clock, useValue: clock },
      ],
    }).compile();
    service = moduleRef.get(ConcertsService);
  });
  const dto = (overrides: Partial<CreateConcertDto> = {}): CreateConcertDto =>
    Object.assign(new CreateConcertDto(), {
      ArtistId: 1,
      Title: 'Gira',
      StartsAt: '2030-06-01T21:00:00-03:00',
      Capacity: 10,
      Price: 5,
      ...overrides,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    artists.findById.mockResolvedValue({ id: 1 });
  });

  it('crea el concierto con la fecha normalizada a UTC', async () => {
    concerts.create.mockResolvedValue({
      concert: new Concert(),
      available: 10,
    });

    await service.create(dto());

    expect(concerts.create).toHaveBeenCalledWith({
      artistId: 1,
      title: 'Gira',
      startsAt: '2030-06-02T00:00:00.000Z',
      capacity: 10,
      price: 5,
    });
  });

  it('artista inexistente → 400 que nombra ArtistId', async () => {
    artists.findById.mockResolvedValue(null);

    await expect(service.create(dto())).rejects.toThrow(/ArtistId/);
    expect(concerts.create).not.toHaveBeenCalled();
  });

  it.each(['2029-12-31T23:59:59Z', '2030-01-01T00:00:00Z'])(
    'StartsAt=%s no es futuro según el reloj → 400',
    async (StartsAt) => {
      const result = service.create(dto({ StartsAt }));

      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      await expect(result).rejects.toThrow(/StartsAt/);
    },
  );

  it('findOne inexistente → 404', async () => {
    concerts.findById.mockResolvedValue(null);

    await expect(service.findOne(9)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findAll pagina en el repository', async () => {
    concerts.findPage.mockResolvedValue([]);

    await service.findAll({ skip: 5, limit: 10 });

    expect(concerts.findPage).toHaveBeenCalledWith(5, 10);
  });
});
