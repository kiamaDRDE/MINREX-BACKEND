import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePostCoverageDto {
  @ApiPropertyOptional({
    example: 'CONSULAR',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(100)
  competenceNature?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description:
      'Date on which this geographic coverage ends.',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}