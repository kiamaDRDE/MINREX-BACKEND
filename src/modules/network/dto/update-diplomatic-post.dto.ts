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
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  DiplomaticPostStatus,
} from '../../../generated/prisma/enums.js';

export class UpdateDiplomaticPostDto {
  @ApiPropertyOptional()
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  typeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hostCountryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentPostId?: string;

  @ApiPropertyOptional({
    enum: DiplomaticPostStatus,
  })
  @IsOptional()
  @IsEnum(
    DiplomaticPostStatus,
  )
  status?: DiplomaticPostStatus;
}