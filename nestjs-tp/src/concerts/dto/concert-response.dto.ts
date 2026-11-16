import { ApiProperty } from '@nestjs/swagger';
import type { ConcertWithAvailability } from '../concerts.repository.js';

/** Concierto tal como lo expone la API, con su disponibilidad calculada (spec 004 RF-2). */
export class ConcertResponseDto {
  @ApiProperty({ example: 1 })
  ConcertId: number;

  @ApiProperty({ example: 1 })
  ArtistId: number;

  @ApiProperty({ type: String, nullable: true, example: 'AC/DC' })
  ArtistName: string | null;

  @ApiProperty({ example: 'Gira 2027' })
  Title: string;

  @ApiProperty({
    example: '2027-03-16T00:00:00.000Z',
    description: 'ISO 8601 en UTC',
  })
  StartsAt: string;

  @ApiProperty({ example: 500 })
  Capacity: number;

  @ApiProperty({ example: 25.5 })
  Price: number;

  @ApiProperty({
    example: 498,
    description: 'Capacidad menos entradas de reservas PAID y COMPLETED',
  })
  Available: number;

  static fromEntity({
    concert,
    available,
  }: ConcertWithAvailability): ConcertResponseDto {
    const dto = new ConcertResponseDto();
    dto.ConcertId = concert.id;
    dto.ArtistId = concert.artistId;
    dto.ArtistName = concert.artist?.name ?? null;
    dto.Title = concert.title;
    dto.StartsAt = concert.startsAt;
    dto.Capacity = concert.capacity;
    dto.Price = concert.price;
    dto.Available = available;
    return dto;
  }
}
