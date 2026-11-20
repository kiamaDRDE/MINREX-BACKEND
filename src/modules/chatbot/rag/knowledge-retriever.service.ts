import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  AssistanceProtocolsService,
  PROTOCOL_CATEGORY_INCLUDE,
} from '../../assistance/protocols/assistance-protocols.service.js';
import {
  APPROVED_MINREX_DOCUMENTS,
  ApprovedDocument,
} from './knowledge-base.data.js';

export interface ProtocolDocumentMetadata {
  categoryId: string;
  code: string;
  shortName: string;
  categoryGroup: string;
  defaultUrgency: string;
  defaultSlaHours: number;
  icon: string;
  legalNotice?: string | null;
  steps: Array<{
    stepNumber: number;
    title: string;
    description: string;
    recommendedDelay?: string | null;
    responsibleRole?: string | null;
    requiredDocs: string[];
  }>;
}

export interface RetrievedPassage {
  document: ApprovedDocument;
  score: number;
  snippet: string;
  protocolMeta?: ProtocolDocumentMetadata;
}

interface CachedProtocolDoc {
  document: ApprovedDocument;
  protocolMeta: ProtocolDocumentMetadata;
}

@Injectable()
export class KnowledgeRetrieverService {
  private readonly logger = new Logger(KnowledgeRetrieverService.name);
  private readonly staticDocuments: ApprovedDocument[] =
    APPROVED_MINREX_DOCUMENTS;
  private protocolCache: CachedProtocolDoc[] = [];
  private protocolCacheExpiresAt = 0;
  private readonly PROTOCOL_CACHE_TTL_MS = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    protocolsService: AssistanceProtocolsService,
  ) {
    protocolsService.onProtocolsChanged(() => this.invalidateProtocolsCache());
  }

  invalidateProtocolsCache(): void {
    this.protocolCacheExpiresAt = 0;
    this.protocolCache = [];
  }

  async getActiveProtocolDocs(): Promise<CachedProtocolDoc[]> {
    const now = Date.now();
    if (now < this.protocolCacheExpiresAt && this.protocolCache.length > 0) {
      return this.protocolCache;
    }

    try {
      const categories = await this.prisma.assistanceCategory.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        take: 100,
        include: PROTOCOL_CATEGORY_INCLUDE,
      });

      const docs: CachedProtocolDoc[] = categories.map((cat) => {
        const stepsText = cat.steps
          .map((s) => {
            const docsSuffix =
              s.requiredDocs && s.requiredDocs.length > 0
                ? ` | Pièces facultatives / utiles : ${s.requiredDocs.join(', ')}`
                : '';
            const delaySuffix = s.recommendedDelay
              ? ` (${s.recommendedDelay})`
              : '';
            const roleSuffix = s.responsibleRole
              ? ` — ${s.responsibleRole}`
              : '';
            return `${s.stepNumber}. **${s.title}**${delaySuffix} : ${s.description}${roleSuffix}${docsSuffix}`;
          })
          .join('\n');

        const keywordSet = new Set<string>();
        const addTokens = (raw?: string | null) => {
          if (!raw) return;
          for (const token of this.normalizeText(raw).split(/[^a-z0-9]+/)) {
            if (token.length >= 3) keywordSet.add(token);
          }
        };

        addTokens(cat.code.replace(/_/g, ' '));
        addTokens(cat.name);
        addTokens(cat.shortName);
        addTokens(cat.categoryGroup);
        addTokens(cat.description);
        for (const step of cat.steps) {
          addTokens(step.title);
        }

        const updatedDate = cat.updatedAt.toISOString().slice(0, 10);
        const summary =
          cat.description?.trim() ||
          `Protocole officiel MINREX (${cat.categoryGroup}) — SLA cible : ${cat.defaultSlaHours} h.`;

        const contentParts = [
          `**Catégorie :** ${cat.categoryGroup} · **Urgence par défaut :** ${cat.defaultUrgency} · **SLA cible :** ${cat.defaultSlaHours} h`,
          cat.description ? `${cat.description}` : '',
          stepsText ? `**Étapes officielles :**\n${stepsText}` : '',
          cat.legalNotice ? `**Cadre réglementaire :** ${cat.legalNotice}` : '',
        ].filter(Boolean);

        const document: ApprovedDocument = {
          id: `db-protocol-${cat.code.toLowerCase()}`,
          title: `${cat.icon ? `${cat.icon} ` : ''}${cat.name}`,
          reference: `Protocole Officiel MINREX · ${cat.code}`,
          updatedAt: updatedDate,
          category: 'ASSISTANCE_URGENCE',
          keywords: Array.from(keywordSet),
          summary,
          content: contentParts.join('\n\n'),
          officialLink: '/espace/assistance',
        };

        return {
          document,
          protocolMeta: {
            categoryId: cat.id,
            code: cat.code,
            shortName: cat.shortName || cat.name,
            categoryGroup: cat.categoryGroup,
            defaultUrgency: cat.defaultUrgency,
            defaultSlaHours: cat.defaultSlaHours,
            icon: cat.icon || '🛡️',
            legalNotice: cat.legalNotice,
            steps: cat.steps.map((s) => ({
              stepNumber: s.stepNumber,
              title: s.title,
              description: s.description,
              recommendedDelay: s.recommendedDelay,
              responsibleRole: s.responsibleRole,
              requiredDocs: s.requiredDocs ?? [],
            })),
          },
        };
      });

      this.protocolCache = docs;
      this.protocolCacheExpiresAt = now + this.PROTOCOL_CACHE_TTL_MS;
      return docs;
    } catch (error) {
      this.logger.warn(
        `Unable to load live assistance protocols from DB for RAG: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.protocolCache;
    }
  }

  /**
   * Retrouve les passages pertinents dans le corpus statique ET les protocoles BD actifs
   */
  async retrieveRelevantDocs(
    query: string,
    limit: number = 3,
  ): Promise<RetrievedPassage[]> {
    const normalizedQuery = this.normalizeText(query);
    const queryTokens = normalizedQuery
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);

    if (queryTokens.length === 0) {
      return [];
    }

    const dbProtocolDocs = await this.getActiveProtocolDocs();
    const candidates: Array<{
      document: ApprovedDocument;
      protocolMeta?: ProtocolDocumentMetadata;
      isDynamicProtocol: boolean;
    }> = [
      ...dbProtocolDocs.map((entry) => ({
        document: entry.document,
        protocolMeta: entry.protocolMeta,
        isDynamicProtocol: true,
      })),
      ...this.staticDocuments.map((doc) => ({
        document: doc,
        isDynamicProtocol: false,
      })),
    ];

    const scored: RetrievedPassage[] = [];

    for (const candidate of candidates) {
      const { document: doc, protocolMeta, isDynamicProtocol } = candidate;
      let score = 0;
      const normalizedTitle = this.normalizeText(doc.title);
      const normalizedContent = this.normalizeText(doc.content);
      const normalizedKeywords = doc.keywords.map((k) => this.normalizeText(k));
      const normalizedCode = protocolMeta
        ? this.normalizeText(protocolMeta.code.replace(/_/g, ' '))
        : '';

      if (normalizedCode && normalizedQuery.includes(normalizedCode)) {
        score += 12;
      }

      for (const token of queryTokens) {
        if (normalizedKeywords.some((k) => k === token || k.includes(token))) {
          score += isDynamicProtocol ? 6 : 5;
        }
        if (normalizedTitle.includes(token)) {
          score += 4;
        }
        if (normalizedContent.includes(token)) {
          score += 1;
        }
      }

      if (score > 0) {
        scored.push({
          document: doc,
          score,
          snippet: doc.summary,
          ...(protocolMeta ? { protocolMeta } : {}),
        });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private normalizeText(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
