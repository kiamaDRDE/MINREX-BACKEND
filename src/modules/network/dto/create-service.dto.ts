import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateServiceDto {
  @ApiProperty({
    example: 'CONSULAR',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string;

  @ApiProperty({
    example: 'Consular Service',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({
    example: 'CONSULAR',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @MaxLength(100)
  serviceType?: string;

  @ApiPropertyOptional({
    example:
      'Handles consular assistance and citizen services.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  description?: string;
}