import { Injectable } from '@nestjs/common';
import {
  APPROVED_MINREX_DOCUMENTS,
  ApprovedDocument,
} from './knowledge-base.data.js';

export interface RetrievedPassage {
  document: ApprovedDocument;
  score: number;
  snippet: string;
}

@Injectable()
export class KnowledgeRetrieverService {
  private readonly documents: ApprovedDocument[] = APPROVED_MINREX_DOCUMENTS;

  /**
   * Retrouve les passages pertinents dans le corpus documentaire approuvé
   */
  async retrieveRelevantDocs(
    query: string,
    limit: number = 3,
  ): Promise<RetrievedPassage[]> {
    const normalizedQuery = this.normalizeText(query);
    const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);

    if (queryTokens.length === 0) {
      return [];
    }

    const scored: RetrievedPassage[] = [];

    for (const doc of this.documents) {
      let score = 0;
      const normalizedTitle = this.normalizeText(doc.title);
      const normalizedContent = this.normalizeText(doc.content);
      const normalizedKeywords = doc.keywords.map((k) => this.normalizeText(k));

      for (const token of queryTokens) {
        // Bonus si dans les mots-clés officiels
        if (normalizedKeywords.some((k) => k.includes(token))) {
          score += 5;
        }
        // Bonus si dans le titre
        if (normalizedTitle.includes(token)) {
          score += 4;
        }
        // Occurrence dans le corps
        if (normalizedContent.includes(token)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({
          document: doc,
          score,
          snippet: doc.summary,
        });
      }
    }

    // Trier par score décroissant et retenir le top N
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Normalisation linguistique (minuscules, retrait des accents simples)
   */
  private normalizeText(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}

