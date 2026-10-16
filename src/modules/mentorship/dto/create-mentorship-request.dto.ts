import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateMentorshipRequestDto {
  @ApiProperty({
    example:
      'Software Engineering Career Development',
    maxLength: 150,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  topic!: string;

  @ApiProperty({
    example:
      'I would like guidance on backend architecture, career progression and international opportunities.',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  objectives!: string;
}