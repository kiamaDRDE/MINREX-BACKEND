import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatSourceDto {
  @ApiProperty({
    description: 'Titre officiel du document de référence',
    example: 'Guide Consulaire Officiel du Recensement (Édition 2026)',
  })
  title!: string;

  @ApiProperty({
    description: 'Référence légale ou administrative du texte',
    example: 'Décret N° 2013/112 fixant les droits de chancellerie',
  })
  reference!: string;

  @ApiPropertyOptional({
    description: 'Date de dernière mise à jour ou validation de la source',
    example: '2026-01-15',
  })
  updatedAt?: string;
}

export type ActionCardType =
  | 'OPEN_INTERNAL_ROUTE'
  | 'OPEN_PROCEDURE'
  | 'VIEW_CENSUS'
  | 'VIEW_ASSISTANCE_CASE'
  | 'PREFILL_ASSISTANCE'
  | 'VIEW_DIPLOMATIC_POST'
  | 'VIEW_ASSOCIATION';

export class ActionCardDto {
  @ApiProperty({
    description: 'Type d’action d’interface proposée au membre',
    example: 'OPEN_INTERNAL_ROUTE',
    enum: [
      'OPEN_INTERNAL_ROUTE',
      'OPEN_PROCEDURE',
      'VIEW_CENSUS',
      'VIEW_ASSISTANCE_CASE',
      'PREFILL_ASSISTANCE',
      'VIEW_DIPLOMATIC_POST',
      'VIEW_ASSOCIATION',
    ],
  })
  type!: ActionCardType;

  @ApiProperty({
    description: 'Titre explicite de la carte d’action',
    example: 'Accéder à mon dossier de recensement',
  })
  title!: string;

  @ApiProperty({
    description: 'Description claire de la démarche',
    example: 'Consulter l’état d’avancement de votre immatriculation consulaire.',
  })
  description!: string;

  @ApiPropertyOptional({
    description: 'Lien de redirection interne validé (liste blanche)',
    example: '/espace/recensement',
  })
  actionUrl?: string;

  @ApiPropertyOptional({
    description: 'Données typées pour pré-remplissage contrôlé (soumission non automatique)',
    example: { urgency: 'HIGH', categoryId: 'arrestation', city: 'Paris' },
  })
  prefillData?: Record<string, unknown>;
}

export class ChatResponseDto {
  @ApiProperty({
    description: 'Identifiant de session conversationnelle',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  conversationId!: string;

  @ApiProperty({
    description: 'Réponse rédigée en Markdown avec ton régalien et bienveillant',
    example:
      'Pour obtenir votre carte consulaire auprès de l’Ambassade du Cameroun à Paris...',
  })
  reply!: string;

  @ApiPropertyOptional({
    description: 'Sources officielles approuvées ayant justifié la réponse',
    type: [ChatSourceDto],
  })
  sources?: ChatSourceDto[];

  @ApiPropertyOptional({
    description: 'Cartes interactives d’orientation ou de pré-remplissage',
    type: [ActionCardDto],
  })
  actionCards?: ActionCardDto[];

  @ApiProperty({
    description: 'Suggestions de questions suivantes pertinentes',
    example: [
      'Quelles sont les pièces justificatives exigées ?',
      'Quels sont les délais de délivrance ?',
    ],
  })
  suggestedFollowUps!: string[];
}

