import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Type,
} from 'class-transformer';

import {
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import {
  CensusStatus,
} from '../../../../generated/prisma/enums.js';

export class ListCensusRecordsQueryDto {
  @ApiPropertyOptional({
    enum: CensusStatus,
  })
  @IsOptional()
  @IsEnum(CensusStatus)
  status?: CensusStatus;

  @ApiPropertyOptional({
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({
    default: 20,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}