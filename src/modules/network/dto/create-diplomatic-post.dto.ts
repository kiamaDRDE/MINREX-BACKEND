import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
  Type,
} from 'class-transformer';

import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
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
    example: 48.8566,
    description:
      'Optional GPS latitude (-90 to 90). Auto-resolved from city/country when omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    example: 2.3522,
    description:
      'Optional GPS longitude (-180 to 180). Auto-resolved from city/country when omitted.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description:
      'Optional parent diplomatic post UUID.',
  })
  @IsOptional()
  @IsUUID()
  parentPostId?: string;
}
