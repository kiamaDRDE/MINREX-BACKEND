import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PublicationTargetScope,
  PublicationType,
} from '../../../generated/prisma/enums.js';

export class CreatePublicationDto {
  @ApiProperty({
    description: 'Titre principal de l’article, annonce ou communiqué',
    example: 'Tournée Consulaire d’enrôlement biométrique à Hambourg',
    maxLength: 250,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  @MaxLength(250)
  title!: string;

  @ApiProperty({
    description: 'Bref résumé d’accroche / chapô',
    example: 'Le consulat général effectuera une mission consulaire de proximité les 15 et 16 avril 2026.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  summary!: string;

  @ApiProperty({
    description: 'Corps complet de l’article ou de la publication (Markdown ou texte formaté)',
    example: '### Modalités d’inscription\nLes ressortissants camerounais sont invités à...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  content!: string;

  @ApiProperty({
    description: 'Type de publication',
    enum: PublicationType,
    example: PublicationType.CONSULAR_NOTICE,
  })
  @IsEnum(PublicationType)
  type!: PublicationType;

  @ApiPropertyOptional({
    description: 'Portée de diffusion cible',
    enum: PublicationTargetScope,
    default: PublicationTargetScope.GLOBAL_PUBLIC,
  })
  @IsOptional()
  @IsEnum(PublicationTargetScope)
  scope?: PublicationTargetScope;

  @ApiPropertyOptional({
    description: 'ID du poste consulaire émetteur ou concerné',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID('4')
  diplomaticPostId?: string;

  @ApiPropertyOptional({
    description: 'ID de l’association partenaire émettrice',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID('4')
  associationId?: string;

  @ApiPropertyOptional({
    description: 'URL de l’image de couverture',
    example: 'https://cdn.minrex.cm/images/articles/tournee-hambourg.jpg',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;

  @ApiPropertyOptional({
    description: 'Pièces jointes ou métadonnées de documents attachés',
    example: [{ name: 'communique_officiel.pdf', url: 'https://cdn.minrex.cm/docs/communique.pdf' }],
  })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiPropertyOptional({
    description: 'Tags thématiques',
    example: ['Consulat', 'Passeports', 'Allemagne', 'Diaspora'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Date d’expiration ou d’archivage automatique (ISO 8601)',
    example: '2026-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

