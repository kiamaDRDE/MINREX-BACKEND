import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  AssistanceUrgency,
} from '../../../../generated/prisma/enums.js';

export class QualifyAssistanceCaseDto {
  @ApiPropertyOptional({
    enum: AssistanceUrgency,
  })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  urgency?: AssistanceUrgency;

  @ApiPropertyOptional({
    example:
      'The request qualifies for consular assistance.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}