import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AssociationReviewAction {
  APPROVE = 'APPROVE',
  REQUEST_CORRECTION = 'REQUEST_CORRECTION',
  REJECT = 'REJECT',
  SUSPEND = 'SUSPEND',
}

export class ReviewAssociationDto {
  @ApiProperty({
    description: 'Action administrative à exécuter',
    enum: AssociationReviewAction,
  })
  @IsEnum(AssociationReviewAction)
  action!: AssociationReviewAction;

  @ApiPropertyOptional({
    description:
      'Motif administratif obligatoire en cas de demande de correction, rejet ou suspension',
    example:
      'Veuillez joindre le récépissé officiel délivré par la Préfecture (ou autorité locale compétente).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motive?: string;
}

export class RequestCorrectionDto {
  @ApiProperty({
    description: 'Observations et liste des éléments à corriger par l’association',
    example:
      'Les statuts téléversés ne sont pas signés. Veuillez déposer la version définitive signée du bureau.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motive!: string;
}

export class RejectAssociationDto {
  @ApiProperty({
    description: 'Motif juridique ou administratif du rejet',
    example:
      'Objet social non conforme aux critères d’éligibilité des associations de la diaspora.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motive!: string;
}

export class SuspendAssociationDto {
  @ApiProperty({
    description: 'Motif de suspension administrative',
    example:
      'Cessation d’activité constatée ou signalement administratif en cours d’examen.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motive!: string;
}
