import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Genre } from './entities/genre.entity.js';
import { GenresRepository } from './genres.repository.js';

describe('GenresRepository', () => {
  let repository: GenresRepository;
  const typeorm = {
    find: vi.fn(),
    findOneBy: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        GenresRepository,
        { provide: getRepositoryToken(Genre), useValue: typeorm },
      ],
    }).compile();
    repository = moduleRef.get(GenresRepository);
  });

  it('pagina EN LA BASE con skip/take y orden por id ascendente (RNF-1, RF-1)', async () => {
    typeorm.find.mockResolvedValue([]);

    await repository.findPage(20, 10);

    expect(typeorm.find).toHaveBeenCalledWith({
      skip: 20,
      take: 10,
      order: { id: 'ASC' },
    });
  });

  it('busca por id con una sola consulta', async () => {
    typeorm.findOneBy.mockResolvedValue(null);

    await expect(repository.findById(7)).resolves.toBeNull();
    expect(typeorm.findOneBy).toHaveBeenCalledWith({ id: 7 });
  });
});
