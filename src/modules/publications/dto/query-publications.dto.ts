import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  PublicationStatus,
  PublicationTargetScope,
  PublicationType,
} from '../../../generated/prisma/enums.js';

export class QueryPublicationsDto {
  @ApiPropertyOptional({
    description: 'Recherche textuelle libre (titre, résumé, contenu)',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par type de publication',
    enum: PublicationType,
  })
  @IsOptional()
  @IsEnum(PublicationType)
  type?: PublicationType;

  @ApiPropertyOptional({
    description: 'Filtrer par statut',
    enum: PublicationStatus,
  })
  @IsOptional()
  @IsEnum(PublicationStatus)
  status?: PublicationStatus;

  @ApiPropertyOptional({
    description: 'Filtrer par portée de visibilité',
    enum: PublicationTargetScope,
  })
  @IsOptional()
  @IsEnum(PublicationTargetScope)
  scope?: PublicationTargetScope;

  @ApiPropertyOptional({
    description: 'Filtrer par poste consulaire',
  })
  @IsOptional()
  @IsUUID('4')
  diplomaticPostId?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par association émettrice',
  })
  @IsOptional()
  @IsUUID('4')
  associationId?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par mot-clé (tag)',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Filtrer uniquement les publications mises à la une (Success Stories / alertes)',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Numéro de page',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Nombre d’éléments par page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

