import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

import {
  Transform,
} from 'class-transformer';

import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  AssistanceType,
  AssistanceUrgency,
} from '../../../generated/prisma/enums.js';

export class CreateAssistanceCaseDto {
  @ApiPropertyOptional({
    enum: AssistanceType,
    example:
      AssistanceType.DOCUMENT_LOSS,
    description:
      'Optional legacy AssistanceType enum. Automatically derived from categoryId / categoryCode when omitted.',
  })
  @IsOptional()
  @IsEnum(AssistanceType)
  type?: AssistanceType;

  @ApiPropertyOptional({
    description:
      'UUID of the AssistanceCategory protocol from PostgreSQL.',
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({
    example: 'ARRESTATION',
    description:
      'Optional code of the AssistanceCategory protocol (e.g. ARRESTATION, PERTE_DOCUMENTS).',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase()
      : value,
  )
  @IsString()
  @MaxLength(50)
  categoryCode?: string;

  @ApiPropertyOptional({
    description:
      'Optional preferred diplomatic post UUID when multiple active posts cover the country.',
  })
  @IsOptional()
  @IsUUID()
  preferredPostId?: string;

  @ApiPropertyOptional({
    enum: AssistanceUrgency,
    default:
      AssistanceUrgency.NORMAL,
  })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  urgency?: AssistanceUrgency;

  @ApiProperty({
    example:
      'Lost passport in France',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    example:
      'My passport was stolen while I was in Paris.',
  })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({
    description:
      'Country where the assistance situation is occurring.',
  })
  @IsUUID()
  countryId!: string;

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

  @ApiPropertyOptional({
    example:
      '15 Avenue Example, Paris',
  })
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
    example:
      'citizen@example.com',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toLowerCase()
      : value,
  )
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({
    example:
      '+33612345678',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim()
      : value,
  )
  @IsString()
  @MaxLength(30)
  contactPhone?: string;
}