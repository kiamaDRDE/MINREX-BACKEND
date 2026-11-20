import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AssignCensusRecordDto {
  @ApiProperty({
    description: 'UUID of the active consular agent assigned to this post.',
  })
  @IsUUID()
  agentUserId!: string;

  @ApiPropertyOptional({
    example: 'Assigné pour vérification documentaire.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
