import {
  ApiProperty,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCountryDto {
  @ApiProperty({
    example: 'CM',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @Length(2, 2)
  iso2Code!: string;

  @ApiProperty({
    example: 'CMR',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @Length(3, 3)
  iso3Code!: string;

  @ApiProperty({
    example: 'Cameroon',
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
}