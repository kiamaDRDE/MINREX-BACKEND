import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  AssociationCategory,
  AssociationStatus,
} from '../../../generated/prisma/enums.js';

export class QueryAssociationsDto {
  @ApiPropertyOptional({
    description: 'Recherche textuelle libre (nom, acronyme, ville, description)',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par pays du siège (UUID)',
  })
  @IsOptional()
  @IsUUID('4')
  countryId?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par catégorie d’association',
    enum: AssociationCategory,
  })
  @IsOptional()
  @IsEnum(AssociationCategory)
  category?: AssociationCategory;

  @ApiPropertyOptional({
    description: 'Filtrer par poste diplomatique compétent (UUID)',
  })
  @IsOptional()
  @IsUUID('4')
  diplomaticPostId?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par statut de l’association',
    enum: AssociationStatus,
  })
  @IsOptional()
  @IsEnum(AssociationStatus)
  status?: AssociationStatus;

  @ApiPropertyOptional({
    description: 'Page courante',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Nombre de résultats par page',
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
