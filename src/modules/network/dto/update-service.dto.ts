import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  ServiceStatus,
} from '../../../generated/prisma/enums.js';

export class UpdateServiceDto {
  @ApiPropertyOptional({
    example: 'CONSULAR',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({
    example: 'Consular Service',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    example: 'CONSULAR',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @MaxLength(100)
  serviceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ServiceStatus,
  })
  @IsOptional()
  @IsEnum(ServiceStatus)
  status?: ServiceStatus;
}