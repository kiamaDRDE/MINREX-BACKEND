import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CaseCommentDto {
  @ApiPropertyOptional({
    example:
      'Processing started.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}