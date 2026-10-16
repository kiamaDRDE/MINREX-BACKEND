import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class AssignAssistanceCaseDto {
  @ApiProperty({
    description:
      'User ID of the agent who will handle the case.',
  })
  @IsUUID()
  agentUserId!: string;

  @ApiPropertyOptional({
    example:
      'Assigned to the protection officer.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}