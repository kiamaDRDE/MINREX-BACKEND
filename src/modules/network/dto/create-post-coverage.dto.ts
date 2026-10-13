import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePostCoverageDto {
  @ApiProperty({
    description:
      'UUID of the country covered by the diplomatic post.',
  })
  @IsUUID()
  countryId!: string;

  @ApiPropertyOptional({
    example: 'CONSULAR',
    description:
      'Nature of the diplomatic or consular competence.',
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
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2027-01-01',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}