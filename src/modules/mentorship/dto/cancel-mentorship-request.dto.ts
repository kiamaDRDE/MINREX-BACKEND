import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CancelMentorshipRequestDto {
  @ApiPropertyOptional({
    example:
      'I no longer need mentorship for this topic.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}