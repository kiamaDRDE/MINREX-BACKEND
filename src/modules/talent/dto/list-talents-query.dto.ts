import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Type,
} from 'class-transformer';

import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListTalentsQueryDto {
  @ApiPropertyOptional({
    type: String,
    description:
      'Free-text search across talent identity and professional information.',
    example:
      'software',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Filter talents by current country of residence.',
    example:
      '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      'Software Engineering',
  })
  @IsOptional()
  @IsString()
  expertiseDomain?: string;

  @ApiPropertyOptional({
    type: String,
    example:
      'NestJS',
  })
  @IsOptional()
  @IsString()
  skill?: string;

  @ApiPropertyOptional({
    type: Number,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    type: Number,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}