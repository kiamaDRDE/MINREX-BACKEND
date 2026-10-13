import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  CensusDocumentType,
} from '../../../../generated/prisma/enums.js';

export class UploadCensusDocumentDto {
  @ApiProperty({
    enum: CensusDocumentType,
    example:
      CensusDocumentType.IDENTITY_DOCUMENT,
  })
  @IsEnum(CensusDocumentType)
  type!: CensusDocumentType;

  @ApiPropertyOptional({
    example: 'C01234567',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  documentNumber?: string;

  @ApiPropertyOptional({
    example: 'Cameroon',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  issuingCountry?: string;

  @ApiPropertyOptional({
    example: '2025-01-10',
  })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({
    example: '2030-01-10',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;
}