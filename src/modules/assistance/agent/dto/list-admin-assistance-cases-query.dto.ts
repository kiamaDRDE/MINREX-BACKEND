import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  AssistanceCaseStatus,
  AssistanceUrgency,
} from '../../../../generated/prisma/enums.js';

export class ListAdminAssistanceCasesQueryDto {
  @ApiPropertyOptional({ enum: AssistanceCaseStatus })
  @IsOptional()
  @IsEnum(AssistanceCaseStatus)
  status?: AssistanceCaseStatus;

  @ApiPropertyOptional({ enum: AssistanceUrgency })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  urgency?: AssistanceUrgency;

  @ApiPropertyOptional({ description: 'Filter by diplomatic post UUID.' })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiPropertyOptional({
    description: 'When true, return only cases escalated to central MINREX.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  escalatedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Search by reference, subject, city, or requester.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
