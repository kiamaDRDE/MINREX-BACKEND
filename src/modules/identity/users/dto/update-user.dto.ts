import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PreferredLanguage,
} from '../../../../generated/prisma/enums.js';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description:
      'Unique username used for authentication.',
    example:
      'ermongabriel',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(
    /^[a-zA-Z0-9._-]+$/,
    {
      message:
        'Username can only contain letters, numbers, dots, underscores and hyphens.',
    },
  )
  username?: string;

  @ApiPropertyOptional({
    description:
      'Contact phone number.',
    example:
      '+237690000000',
    nullable:
      true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    return typeof value === 'string'
      ? value.trim()
      : value;
  })
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({
    example:
      'Ermon',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({
    example:
      'Gabriel',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    description:
      'Optional display name.',
    example:
      'Ermon Gabriel',
    nullable:
      true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    return typeof value === 'string'
      ? value.trim()
      : value;
  })
  @IsString()
  @MaxLength(200)
  displayName?: string | null;

  @ApiPropertyOptional({
    description:
      'Optional profile photo URL.',
    nullable:
      true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    return typeof value === 'string'
      ? value.trim()
      : value;
  })
  @IsString()
  @MaxLength(500)
  photoUrl?: string | null;

  @ApiPropertyOptional({
    enum:
      PreferredLanguage,
    example:
      PreferredLanguage.FR,
  })
  @IsOptional()
  @IsEnum(
    PreferredLanguage,
  )
  preferredLanguage?:
    PreferredLanguage;
}