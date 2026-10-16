import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RejectAssistanceCaseDto {
  @ApiProperty({
    example:
      'The request does not fall within the scope of consular assistance.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  reason!: string;
}