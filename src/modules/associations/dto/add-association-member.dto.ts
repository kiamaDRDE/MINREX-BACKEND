import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AssociationMemberRole } from '../../../generated/prisma/enums.js';

export class AddAssociationMemberDto {
  @ApiProperty({
    description: 'Adresse email du membre à rattacher',
    example: 'secretaire@acif-france.org',
  })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description: 'Rôle associatif au sein de l’association',
    enum: AssociationMemberRole,
    example: AssociationMemberRole.SECRETARY_GENERAL,
  })
  @IsEnum(AssociationMemberRole)
  @IsNotEmpty()
  role!: AssociationMemberRole;

  @ApiPropertyOptional({
    description: 'Statut de représentant légal (mandataire consulaire)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isLegalRepresentative?: boolean;

  @ApiPropertyOptional({
    description: 'Titre ou fonction honorifique au sein du bureau',
    example: 'Secrétaire Général Adjoint',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;
}

export class UpdateAssociationMemberDto {
  @ApiPropertyOptional({
    description: 'Rôle associatif au sein de l’association',
    enum: AssociationMemberRole,
  })
  @IsOptional()
  @IsEnum(AssociationMemberRole)
  role?: AssociationMemberRole;

  @ApiPropertyOptional({
    description: 'Statut de représentant légal (mandataire consulaire)',
  })
  @IsOptional()
  @IsBoolean()
  isLegalRepresentative?: boolean;

  @ApiPropertyOptional({
    description: 'Titre ou fonction au sein du bureau',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Statut d’activité du membre',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
