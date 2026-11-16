import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlbumsRepository } from './albums.repository.js';
import { Album } from './entities/album.entity.js';

describe('AlbumsRepository', () => {
  let repository: AlbumsRepository;
  const typeorm = { find: vi.fn(), findOne: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        AlbumsRepository,
        { provide: getRepositoryToken(Album), useValue: typeorm },
      ],
    }).compile();
    repository = moduleRef.get(AlbumsRepository);
  });

  it('pagina EN LA BASE y trae el artista en la misma consulta (RNF-1, RF-1, RF-4)', async () => {
    typeorm.find.mockResolvedValue([]);

    await repository.findPage(10, 5);

    expect(typeorm.find).toHaveBeenCalledWith({
      skip: 10,
      take: 5,
      order: { id: 'ASC' },
      relations: { artist: true },
    });
  });

  it('busca por id con su artista', async () => {
    typeorm.findOne.mockResolvedValue(null);

    await repository.findById(4);

    expect(typeorm.findOne).toHaveBeenCalledWith({
      where: { id: 4 },
      relations: { artist: true },
    });
  });
});
