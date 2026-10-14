import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RejectMentorshipRequestDto {
  @ApiProperty({
    example:
      'The request does not fall within the current mentorship programme.',
    maxLength: 1000,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}