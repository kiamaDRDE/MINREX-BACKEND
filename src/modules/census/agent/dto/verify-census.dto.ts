import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class VerifyCensusDto {
  @ApiPropertyOptional({
    example:
      'Identity and residence information verified.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}