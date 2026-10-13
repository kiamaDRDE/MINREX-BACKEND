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
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDiplomaticPostDto {
  @ApiProperty({
    example: 'AMB-PARIS',
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
    example:
      'Embassy of Cameroon in France',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({
    description:
      'Diplomatic post type UUID.',
  })
  @IsUUID()
  typeId!: string;

  @ApiPropertyOptional({
    description:
      'Country where the diplomatic post is physically located.',
  })
  @IsOptional()
  @IsUUID()
  hostCountryId?: string;

  @ApiPropertyOptional({
    example: 'Paris',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(150)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    description:
      'Optional parent diplomatic post UUID.',
  })
  @IsOptional()
  @IsUUID()
  parentPostId?: string;
}