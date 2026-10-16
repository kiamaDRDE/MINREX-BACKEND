import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RejectCensusDocumentDto {
  @ApiProperty({
    example:
      'The uploaded document is unreadable.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}