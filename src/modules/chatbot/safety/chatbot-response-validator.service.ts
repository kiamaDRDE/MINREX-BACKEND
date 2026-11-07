import { Injectable } from '@nestjs/common';
import { ChatSourceDto } from '../dto/chat-response.dto.js';

@Injectable()
export class ChatbotResponseValidatorService {
  /**
   * Assainit le texte de la réponse (supprime balises scripts, protocoles javascript:, etc.)
   */
  sanitizeReply(text: string): string {
    if (!text) return '';

    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript\s*:/gi, 'unsafe-protocol:')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .trim();
  }

  /**
   * Filtre et dédoublonne les sources citées
   */
  validateSources(sources: ChatSourceDto[] = []): ChatSourceDto[] {
    const seen = new Set<string>();
    const unique: ChatSourceDto[] = [];

    for (const source of sources) {
      if (!source.title || !source.reference) continue;
      const key = `${source.title}::${source.reference}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(source);
      }
    }

    return unique;
  }
}

