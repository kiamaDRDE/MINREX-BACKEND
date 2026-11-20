import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { AssistanceUrgency } from '../../../generated/prisma/enums.js';

export const PROTOCOL_CATEGORY_GROUPS = [
  'Urgence & Détresse',
  'Aide Sociale & Financière',
  'Protection Spéciale',
] as const;

export type ProtocolCategoryGroup = (typeof PROTOCOL_CATEGORY_GROUPS)[number];

export class ProtocolStepInputDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepNumber?: number;

  @ApiProperty({ example: 'Notification & Alerte consulaire' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  title!: string;

  @ApiProperty({
    example: 'Enregistrement prioritaire de la saisine et vérification des coordonnées.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  description!: string;

  @ApiPropertyOptional({ example: '< 4h' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  recommendedDelay?: string;

  @ApiPropertyOptional({ example: 'Agent consulaire de permanence' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  responsibleRole?: string;

  @ApiPropertyOptional({
    type: [String],
    default: [],
    description: 'Liste facultative des pièces justificatives recommandées pour cette étape.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
          .map((item) => (typeof item === 'string' ? item.trim() : ''))
          .filter((item) => item.length > 0)
      : [],
  )
  requiredDocs?: string[];
}

export class CreateAssistanceCategoryDto {
  @ApiProperty({ example: 'EVACUATION_SANITAIRE' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase().replace(/\s+/g, '_') : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: "En cas d'évacuation sanitaire d'urgence" })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional({ example: 'Évacuation Sanitaire' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @ApiPropertyOptional({
    enum: PROTOCOL_CATEGORY_GROUPS,
    default: 'Urgence & Détresse',
  })
  @IsOptional()
  @IsIn(PROTOCOL_CATEGORY_GROUPS)
  categoryGroup?: ProtocolCategoryGroup;

  @ApiPropertyOptional({
    example: 'Coordination médicale et autorisations de transfert sanitaire vers le Cameroun.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Mention légale ou note réglementaire spécifique au protocole (optionnel).',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  legalNotice?: string;

  @ApiPropertyOptional({ example: '🛡️' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 'bg-emerald-600 text-white' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  badgeColor?: string;

  @ApiPropertyOptional({
    enum: AssistanceUrgency,
    default: AssistanceUrgency.NORMAL,
  })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  defaultUrgency?: AssistanceUrgency;

  @ApiPropertyOptional({ example: 24, minimum: 1, maximum: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  defaultSlaHours?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiProperty({ type: [ProtocolStepInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProtocolStepInputDto)
  steps!: ProtocolStepInputDto[];
}

export class UpdateAssistanceCategoryDto {
  @ApiPropertyOptional({ example: "En cas d'évacuation sanitaire d'urgence" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'Évacuation Sanitaire' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @ApiPropertyOptional({ enum: PROTOCOL_CATEGORY_GROUPS })
  @IsOptional()
  @IsIn(PROTOCOL_CATEGORY_GROUPS)
  categoryGroup?: ProtocolCategoryGroup;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  legalNotice?: string;

  @ApiPropertyOptional({ example: '🛡️' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  badgeColor?: string;

  @ApiPropertyOptional({ enum: AssistanceUrgency })
  @IsOptional()
  @IsEnum(AssistanceUrgency)
  defaultUrgency?: AssistanceUrgency;

  @ApiPropertyOptional({ minimum: 1, maximum: 720 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  defaultSlaHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ type: [ProtocolStepInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProtocolStepInputDto)
  steps?: ProtocolStepInputDto[];
}
