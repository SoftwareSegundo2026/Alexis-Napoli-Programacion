import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArtistsRepository } from './artists.repository.js';
import { Artist } from './entities/artist.entity.js';

describe('ArtistsRepository', () => {
  let repository: ArtistsRepository;
  const typeorm = { find: vi.fn(), findOneBy: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ArtistsRepository,
        { provide: getRepositoryToken(Artist), useValue: typeorm },
      ],
    }).compile();
    repository = moduleRef.get(ArtistsRepository);
  });

  it('pagina EN LA BASE con skip/take y orden por id ascendente (RNF-1, RF-1)', async () => {
    typeorm.find.mockResolvedValue([]);

    await repository.findPage(0, 50);

    expect(typeorm.find).toHaveBeenCalledWith({
      skip: 0,
      take: 50,
      order: { id: 'ASC' },
    });
  });

  it('busca por id', async () => {
    typeorm.findOneBy.mockResolvedValue(null);

    await repository.findById(3);

    expect(typeorm.findOneBy).toHaveBeenCalledWith({ id: 3 });
  });
});
