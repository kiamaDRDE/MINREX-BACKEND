import {
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
  Type,
} from 'class-transformer';

import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ContactChannel,
  DepartureReason,
  EmploymentStatus,
  MaritalStatus,
  ResidenceStatus,
} from '../../../generated/prisma/enums.js';

export class UpdateCensusRecordDto {
  /*
  |--------------------------------------------------------------------------
  | Identity
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({
    example: '1998-04-15',
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({
    example: 'Yaoundé',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  birthPlace?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  nationalityCountryId?: string;

  /*
  |--------------------------------------------------------------------------
  | Contact
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: '+33612345678',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  primaryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  secondaryPhone?: string;

  @ApiPropertyOptional({
    enum: ContactChannel,
  })
  @IsOptional()
  @IsEnum(ContactChannel)
  preferredContactChannel?: ContactChannel;

  /*
  |--------------------------------------------------------------------------
  | Residence abroad
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  residenceCountryId?: string;

  @ApiPropertyOptional({
    example: 'Paris',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  residenceCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  residenceAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  residencePostalCode?: string;

  @ApiPropertyOptional({
    example: 2022,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  residenceSinceYear?: number;

  @ApiPropertyOptional({
    enum: ResidenceStatus,
  })
  @IsOptional()
  @IsEnum(ResidenceStatus)
  residenceStatus?: ResidenceStatus;

  /*
  |--------------------------------------------------------------------------
  | Cameroon attachment
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional({
    example: 'Centre',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cameroonRegion?: string;

  @ApiPropertyOptional({
    example: 'Yaoundé',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  cameroonCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastCameroonAddress?: string;

  @ApiPropertyOptional({
    example: 2022,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  departureYear?: number;

  @ApiPropertyOptional({
    enum: DepartureReason,
  })
  @IsOptional()
  @IsEnum(DepartureReason)
  departureReason?: DepartureReason;

  /*
  |--------------------------------------------------------------------------
  | Family
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional({
    enum: MaritalStatus,
  })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({
    example: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dependantsCount?: number;

  /*
  |--------------------------------------------------------------------------
  | Professional situation
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional({
    enum: EmploymentStatus,
  })
  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({
    example: 'Software Engineer',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  profession?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  employer?: string;

  @ApiPropertyOptional({
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  /*
  |--------------------------------------------------------------------------
  | Declarations
  |--------------------------------------------------------------------------
  */

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value)
  @IsBoolean()
  declaredAccurate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  consentDataProcessing?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  privacyNoticeAccepted?: boolean;
}