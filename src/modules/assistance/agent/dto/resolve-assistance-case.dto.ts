import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResolveAssistanceCaseDto {
  @ApiProperty({
    example:
      'The citizen received the required consular assistance.',
  })
  @IsString()
  @MinLength(5)
  @MaxLength(5000)
  resolutionSummary!: string;
}