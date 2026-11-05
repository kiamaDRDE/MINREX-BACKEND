import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  AssociationCategory,
  AssociationMemberRole,
} from '../../../generated/prisma/enums.js';

export class CreateAssociationDto {
  @ApiProperty({
    description: "Nom officiel de l'association",
    example: 'Association des Camerounais d’Île-de-France (ACIF)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({
    description: "Sigle ou acronyme de l'association",
    example: 'ACIF',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  acronym?: string;

  @ApiProperty({
    description: 'Catégorie thématique de l’association',
    enum: AssociationCategory,
    default: AssociationCategory.COMMUNITY,
  })
  @IsEnum(AssociationCategory)
  category: AssociationCategory = AssociationCategory.COMMUNITY;

  @ApiProperty({
    description: 'Description détaillée et historique de l’association',
    example:
      'Regroupement communautaire et d’entraide mutuelle des Camerounais résidant en Île-de-France.',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;

  @ApiPropertyOptional({
    description: 'Missions, buts et objectifs statutaires',
  })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiPropertyOptional({
    description: 'Date de création officielle ou déclaration préfectorale',
    example: '2018-05-12',
  })
  @IsOptional()
  @IsDateString()
  creationDate?: string;

  @ApiProperty({
    description: 'ID du pays du siège de l’association (UUID)',
  })
  @IsUUID('4')
  countryId!: string;

  @ApiProperty({
    description: 'Ville d’établissement du siège',
    example: 'Paris',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  city!: string;

  @ApiPropertyOptional({
    description: 'Adresse physique ou postale complète du siège',
    example: '15 Rue de la Solidarité, 75019 Paris',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({
    description: 'Code postal',
    example: '75019',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @ApiProperty({
    description: 'Adresse courriel officielle de contact',
    example: 'contact@acif-france.org',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Numéro de téléphone officiel',
    example: '+33 1 42 00 12 34',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phone!: string;

  @ApiPropertyOptional({
    description: 'Site web officiel ou page publique',
    example: 'https://acif-france.org',
  })
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

  @ApiPropertyOptional({
    description: 'URL du logo de l’association',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({
    description: 'Fonction du déclarant au sein de l’association',
    enum: AssociationMemberRole,
    default: AssociationMemberRole.PRESIDENT,
  })
  @IsOptional()
  @IsEnum(AssociationMemberRole)
  myRoleInAssociation?: AssociationMemberRole = AssociationMemberRole.PRESIDENT;

  @ApiPropertyOptional({
    description: 'Titre honorifique ou fonction exacte',
    example: 'Président Fondateur',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  myTitleInAssociation?: string = 'Président Fondateur';
}
