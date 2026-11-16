import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InvoiceLine } from './entities/invoice-line.entity.js';
import { MediaType } from './entities/media-type.entity.js';
import { PlaylistTrack } from './entities/playlist-track.entity.js';
import { Track } from './entities/track.entity.js';
import { TracksRepository } from './tracks.repository.js';

describe('TracksRepository', () => {
  let repository: TracksRepository;
  const tracks = { find: vi.fn(), findOne: vi.fn() };
  const mediaTypes = { existsBy: vi.fn() };
  const invoiceLines = { countBy: vi.fn() };
  const playlistTracks = { countBy: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        TracksRepository,
        { provide: getRepositoryToken(Track), useValue: tracks },
        { provide: getRepositoryToken(MediaType), useValue: mediaTypes },
        { provide: getRepositoryToken(InvoiceLine), useValue: invoiceLines },
        {
          provide: getRepositoryToken(PlaylistTrack),
          useValue: playlistTracks,
        },
      ],
    }).compile();
    repository = moduleRef.get(TracksRepository);
  });

  it('pagina EN LA BASE y trae álbum, género y tipo de medio (RNF-1, RF-1, RF-5)', async () => {
    tracks.find.mockResolvedValue([]);

    await repository.findPage(3400, 100);

    expect(tracks.find).toHaveBeenCalledWith({
      skip: 3400,
      take: 100,
      order: { id: 'ASC' },
      relations: { album: true, genre: true, mediaType: true },
    });
  });

  it('cuenta facturas y playlists que usan la pista (RF-12)', async () => {
    invoiceLines.countBy.mockResolvedValue(2);
    playlistTracks.countBy.mockResolvedValue(5);

    await expect(repository.countReferences(1)).resolves.toEqual({
      invoiceLines: 2,
      playlists: 5,
    });
    expect(invoiceLines.countBy).toHaveBeenCalledWith({ trackId: 1 });
    expect(playlistTracks.countBy).toHaveBeenCalledWith({ trackId: 1 });
  });

  it('comprueba si existe un tipo de medio', async () => {
    mediaTypes.existsBy.mockResolvedValue(false);

    await expect(repository.mediaTypeExists(99)).resolves.toBe(false);
    expect(mediaTypes.existsBy).toHaveBeenCalledWith({ id: 99 });
  });
});
