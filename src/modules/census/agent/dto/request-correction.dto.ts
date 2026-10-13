import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RequestCorrectionDto {
  @ApiProperty({
    example:
      'Please correct your residence address and provide your current professional situation.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  comment!: string;

  @ApiProperty({
    example: [
      'residenceAddress',
      'employmentStatus',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({
    each: true,
  })
  @MaxLength(100, {
    each: true,
  })
  correctionFields!: string[];
}