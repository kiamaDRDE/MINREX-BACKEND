import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({
    description: 'Message saisi par le membre de la diaspora en langage naturel',
    example: 'Comment faire pour renouveler ma carte consulaire à Paris ?',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message!: string;

  @ApiPropertyOptional({
    description: 'Identifiant UUID de session conversationnelle pour le suivi du fil de discussion',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({
    description: 'Indication optionnelle de la route courante du frontend (ne confère aucun droit)',
    example: '/espace/recensement',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  currentRoute?: string;
}

