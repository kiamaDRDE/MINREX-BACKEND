import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdvanceStepDto {
  @ApiPropertyOptional({
    example: 2,
    description:
      'Optional target step number completed. Defaults to advancing the current step by 1.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepNumber?: number;

  @ApiPropertyOptional({
    example: 'Visite consulaire effectuée au centre de rétention.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
