import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RejectCensusDto {
  @ApiProperty({
    example:
      'The information provided could not be validated.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  reason!: string;
}