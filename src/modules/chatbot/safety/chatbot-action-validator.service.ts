import { Injectable, Logger } from '@nestjs/common';
import { ActionCardDto, ActionCardType } from '../dto/chat-response.dto.js';

const ALLOWED_INTERNAL_ROUTES = [
  '/espace/recensement',
  '/espace/assistance',
  '/espace/associations',
  '/espace/publications',
  '/espace/documents',
  '/espace/services',
  '/reseau-diplomatique',
  '/communaute',
  '/success-stories',
  '/profil',
] as const;

const ALLOWED_ACTION_TYPES: ActionCardType[] = [
  'OPEN_INTERNAL_ROUTE',
  'OPEN_PROCEDURE',
  'VIEW_CENSUS',
  'VIEW_ASSISTANCE_CASE',
  'PREFILL_ASSISTANCE',
  'VIEW_DIPLOMATIC_POST',
  'VIEW_ASSOCIATION',
];

@Injectable()
export class ChatbotActionValidatorService {
  private readonly logger = new Logger(ChatbotActionValidatorService.name);

  validateAndFilterActionCards(cards: ActionCardDto[] = []): ActionCardDto[] {
    const validated: ActionCardDto[] = [];

    for (const card of cards) {
      if (!card.title || !card.type) {
        continue;
      }

      if (!ALLOWED_ACTION_TYPES.includes(card.type)) {
        this.logger.warn(`Action card rejetée car type non autorisé : ${card.type}`);
        continue;
      }

      // Si une URL d'action est fournie, elle doit appartenir à la liste blanche
      if (card.actionUrl) {
        const isAllowedRoute = ALLOWED_INTERNAL_ROUTES.some(
          (route) =>
            card.actionUrl === route || card.actionUrl?.startsWith(`${route}/`),
        );

        if (!isAllowedRoute) {
          this.logger.warn(
            `Action card rejetée car URL non autorisée dans la liste blanche : ${card.actionUrl}`,
          );
          continue;
        }
      }

      validated.push(card);
    }

    return validated;
  }
}

