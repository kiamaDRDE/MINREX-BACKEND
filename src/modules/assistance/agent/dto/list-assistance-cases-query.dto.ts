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
  AssistanceCaseStatus,
  AssistanceUrgency,
} from '../../../../generated/prisma/enums.js';

export class ListAssistanceCasesQueryDto {
  @ApiPropertyOptional({
    type: String,
    enum: AssistanceCaseStatus,
    enumName: 'AssistanceCaseStatus',
    example:
      AssistanceCaseStatus.SUBMITTED,
  })
  @IsOptional()
  @IsEnum(AssistanceCaseStatus)
  status?: AssistanceCaseStatus;

  @ApiPropertyOptional({
    type: String,
    enum: AssistanceUrgency,
    enumName: 'AssistanceUrgency',
    example:
      AssistanceUrgency.NORMAL,
  })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  urgency?: AssistanceUrgency;

  @ApiPropertyOptional({
    type: Number,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}