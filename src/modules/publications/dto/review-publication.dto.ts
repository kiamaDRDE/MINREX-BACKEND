import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PublicationReviewDecision } from '../../../generated/prisma/enums.js';

export class ReviewPublicationDto {
  @ApiProperty({
    description: 'Décision de modération ou de validation',
    enum: PublicationReviewDecision,
    example: PublicationReviewDecision.VALIDATED_TO_LEVEL2,
  })
  @IsEnum(PublicationReviewDecision)
  @IsNotEmpty()
  decision!: PublicationReviewDecision;

  @ApiPropertyOptional({
    description: 'Commentaire ou motif obligatoire en cas de demande de correction ou rejet',
    example: 'Veuillez préciser la liste des pièces requises pour les usagers dans le paragraphe 2.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

