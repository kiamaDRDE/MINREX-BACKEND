import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { AssistanceUrgency } from '../../../../generated/prisma/enums.js';

export class EscalateAssistanceCaseDto {
  @ApiProperty({
    example: 'Dépassement du délai SLA ou arbitrage central MINREX requis.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional({
    enum: AssistanceUrgency,
    default: AssistanceUrgency.CRITICAL,
  })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  urgency?: AssistanceUrgency;
}
