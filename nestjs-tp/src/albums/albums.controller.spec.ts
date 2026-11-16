import { Test, TestingModule } from '@nestjs/testing';
import { Artist } from '../artists/entities/artist.entity.js';
import { AlbumsController } from './albums.controller.js';
import { AlbumsService } from './albums.service.js';
import { Album } from './entities/album.entity.js';

describe('AlbumsController', () => {
  let controller: AlbumsController;
  const service = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const storedAlbum = Object.assign(new Album(), {
    id: 1,
    title: 'Back in Black',
    artistId: 1,
    imageUrl: '/img/1.jpg',
    artist: Object.assign(new Artist(), { id: 1, name: 'AC/DC' }),
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlbumsController],
      providers: [{ provide: AlbumsService, useValue: service }],
    }).compile();

    controller = module.get<AlbumsController>(AlbumsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('responde con los nombres del contrato, incluido ArtistName (RF-4, RNF-2)', async () => {
    service.findOne.mockResolvedValue(storedAlbum);

    await expect(controller.findOne(1)).resolves.toEqual({
      AlbumId: 1,
      Title: 'Back in Black',
      ArtistId: 1,
      ImageUrl: '/img/1.jpg',
      ArtistName: 'AC/DC',
    });
  });

  it('el listado pasa la paginación al service y convierte cada álbum', async () => {
    service.findAll.mockResolvedValue([storedAlbum]);

    const result = await controller.findAll({ skip: 0, limit: 1 });

    expect(service.findAll).toHaveBeenCalledWith({ skip: 0, limit: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].ArtistName).toBe('AC/DC');
  });
});
