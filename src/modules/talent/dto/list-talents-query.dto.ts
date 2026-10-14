import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
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
    description:
      'Free-text search across talent identity and professional information.',
    example: 'software',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description:
      'Filter talents by current country of residence.',
  })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({
    example: 'Software Engineering',
  })
  @IsOptional()
  @IsString()
  expertiseDomain?: string;

  @ApiPropertyOptional({
    example: 'NestJS',
  })
  @IsOptional()
  @IsString()
  skill?: string;

  @ApiPropertyOptional({
    default: 1,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}