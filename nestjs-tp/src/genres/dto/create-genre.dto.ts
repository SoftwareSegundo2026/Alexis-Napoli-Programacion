import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/validation/trim.decorator.js';

/** Cuerpo de `POST /genres` (RF-6, RF-9). */
export class CreateGenreDto {
  @ApiProperty({ maxLength: 120, example: 'Cumbia' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  Name: string;
}
