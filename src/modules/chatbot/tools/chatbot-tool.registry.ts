import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { AssistanceService } from '../../assistance/assistance.service.js';
import { AssistanceProtocolsService } from '../../assistance/protocols/assistance-protocols.service.js';
import { CensusService } from '../../census/census.service.js';
import { LLMToolDefinition } from '../providers/llm-provider.interface.js';
import { KnowledgeRetrieverService } from '../rag/knowledge-retriever.service.js';
import {
  ChatbotTool,
  ChatbotToolContext,
} from './chatbot-tool.interface.js';

@Injectable()
export class ChatbotToolRegistry {
  private readonly logger = new Logger(ChatbotToolRegistry.name);
  private readonly tools = new Map<string, ChatbotTool>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly censusService: CensusService,
    private readonly assistanceService: AssistanceService,
    private readonly protocolsService: AssistanceProtocolsService,
    private readonly knowledgeRetriever: KnowledgeRetrieverService,
  ) {
    this.registerTools();
  }

  getToolDefinitions(): LLMToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async executeTool(
    name: string,
    args: Record<string, unknown>,
    context: ChatbotToolContext,
  ): Promise<Record<string, unknown>> {
    const tool = this.tools.get(name);
    if (!tool) {
      this.logger.warn(`Tentative d'exécution d'un outil non autorisé: ${name}`);
      return {
        error: `L'outil ${name} n'existe pas ou n'est pas autorisé dans la liste blanche.`,
      };
    }

    try {
      return await tool.execute(args, context);
    } catch (err: unknown) {
      this.logger.error(
        `Erreur d'exécution de l'outil ${name}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return {
        error:
          'Une erreur interne est survenue lors de la consultation des données du service.',
      };
    }
  }

  private registerTools() {
    // ── Outil 1 : Statut du recensement personnel ──
    this.tools.set('getMyCensusStatus', {
      definition: {
        name: 'getMyCensusStatus',
        description:
          'Consulte le statut officiel communicable du dossier de recensement / immatriculation consulaire du membre connecté.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      execute: async (_args, context) => {
        const result = await this.censusService.getMyCensus(context.userId);
        const record = result.record;
        if (!record) {
          return {
            hasRecord: false,
            message:
              'Aucun dossier de recensement consulaire n’a encore été initié par ce membre.',
          };
        }

        return {
          hasRecord: true,
          status: record.status,
          isVerified: record.status === 'VERIFIED',
          reference: record.reference || null,
          residenceCountry: record.residenceCountry?.name || null,
          residenceCity: record.residenceCity || null,
          assignedPost: record.assignedPost?.name || null,
          submittedAt: record.submittedAt || null,
          verifiedAt: record.verifiedAt || null,
        };
      },
    });

    // ── Outil 2 : Statut des demandes d'assistance consulaire (corrigé : c.reference + c.urgency) ──
    this.tools.set('getMyAssistanceCases', {
      definition: {
        name: 'getMyAssistanceCases',
        description:
          'Consulte la liste des dossiers d’assistance consulaire ou d’urgence déposés par le membre connecté (uniquement les champs communicables au demandeur).',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      execute: async (_args, context) => {
        const casesRes = await this.assistanceService.findMyCases(
          context.userId,
        );
        const cases = casesRes.items;
        if (!cases || cases.length === 0) {
          return {
            hasCases: false,
            cases: [],
            message: 'Aucun dossier d’assistance en cours pour ce membre.',
          };
        }

        return {
          hasCases: true,
          total: cases.length,
          cases: cases.map((c) => ({
            reference: c.reference || c.id,
            status: c.status,
            urgency: c.urgency,
            category: c.category?.shortName || c.category?.name || c.type,
            subject: c.subject,
            city: c.city || null,
            country: c.country?.name || null,
            assignedPost: c.assignedPost?.name || null,
            currentStepNumber: c.currentStepNumber,
            createdAt: c.createdAt,
            resolvedAt: c.resolvedAt || null,
          })),
        };
      },
    });

    // ── Outil 3 : Recherche du poste diplomatique compétent ──
    this.tools.set('findDiplomaticPost', {
      definition: {
        name: 'findDiplomaticPost',
        description:
          'Identifie l’Ambassade ou le Consulat Général du Cameroun compétent pour un pays et une ville donnés, et renvoie ses coordonnées officielles.',
        parameters: {
          type: 'object',
          properties: {
            country: {
              type: 'string',
              description:
                'Nom ou code du pays de résidence (ex: France, Allemagne, USA, Gabon)',
            },
            city: {
              type: 'string',
              description:
                'Ville de résidence optionnelle (ex: Paris, Marseille, Berlin, Washington)',
            },
          },
          required: ['country'],
        },
      },
      execute: async (args) => {
        const countryVal = typeof args.country === 'string' ? args.country : '';
        const countryQuery = countryVal.trim();
        if (!countryQuery) {
          return { found: false, message: 'Le nom du pays est requis.' };
        }

        const coverages = await this.prisma.postCoverage.findMany({
          where: {
            endDate: null,
            country: {
              OR: [
                { name: { contains: countryQuery, mode: 'insensitive' } },
                { iso2Code: { equals: countryQuery.toUpperCase() } },
                { iso3Code: { equals: countryQuery.toUpperCase() } },
              ],
            },
            post: {
              status: 'ACTIVE',
            },
          },
          include: {
            post: {
              include: {
                type: true,
              },
            },
            country: true,
          },
          take: 5,
        });

        if (coverages.length === 0) {
          return {
            found: false,
            message: `Aucune représentation diplomatique active trouvée pour le pays : ${countryQuery}.`,
          };
        }

        return {
          found: true,
          country: coverages[0]!.country.name,
          posts: coverages.map((c) => ({
            name: c.post.name,
            code: c.post.code,
            type: c.post.type?.name || 'Mission diplomatique',
            city: c.post.city || null,
            address: c.post.address || null,
          })),
        };
      },
    });

    // ── Outil 4 : Recherche dans les procédures officielles approuvées + protocoles BD ──
    this.tools.set('searchApprovedProcedures', {
      definition: {
        name: 'searchApprovedProcedures',
        description:
          'Recherche les démarches, textes de lois, protocoles d’assistance BD, délais SLA et conditions légales dans le corpus officiel du MINREX.',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description:
                'Thème recherché (ex: passeport, laissez-passer, décès, arrestation, association, évacuation)',
            },
          },
          required: ['topic'],
        },
      },
      execute: async (args) => {
        const topicVal = typeof args.topic === 'string' ? args.topic : '';
        const topic = topicVal.trim();
        const results = await this.knowledgeRetriever.retrieveRelevantDocs(
          topic,
          3,
        );

        return {
          resultsCount: results.length,
          documents: results.map((r) => ({
            title: r.document.title,
            reference: r.document.reference,
            updatedAt: r.document.updatedAt,
            summary: r.document.summary,
            content: r.document.content,
            officialLink: r.document.officialLink || null,
          })),
        };
      },
    });

    // ── Outil 5 : Liste dynamique des protocoles d'assistance actifs en BD ──
    this.tools.set('listAssistanceProtocols', {
      definition: {
        name: 'listAssistanceProtocols',
        description:
          'Liste tous les protocoles et catégories d’assistance consulaire actuellement actifs dans la base de données du MINREX.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      execute: async () => {
        const { items } = await this.protocolsService.listCategories(false);
        return {
          total: items.length,
          protocols: items.map((cat) => ({
            id: cat.id,
            code: cat.code,
            name: cat.name,
            shortName: cat.shortName || cat.name,
            categoryGroup: cat.categoryGroup,
            defaultUrgency: cat.defaultUrgency,
            defaultSlaHours: cat.defaultSlaHours,
            stepCount: cat.steps.length,
            description: cat.description,
          })),
        };
      },
    });

    // ── Outil 6 : Détail complet d'un protocole d'assistance depuis la BD ──
    this.tools.set('getAssistanceProtocolDetails', {
      definition: {
        name: 'getAssistanceProtocolDetails',
        description:
          'Retourne les étapes opérationnelles, délais recommandés, responsables et pièces facultatives d’un protocole d’assistance spécifique en base de données.',
        parameters: {
          type: 'object',
          properties: {
            codeOrTopic: {
              type: 'string',
              description:
                'Code exact (ex: ARRESTATION, PERTE_DOCUMENTS) ou mot-clé du protocole recherché.',
            },
          },
          required: ['codeOrTopic'],
        },
      },
      execute: async (args) => {
        const raw =
          typeof args.codeOrTopic === 'string' ? args.codeOrTopic.trim() : '';
        if (!raw) {
          return { found: false, message: 'Code ou mot-clé requis.' };
        }

        const { items } = await this.protocolsService.listCategories(false);
        const normalized = raw
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');

        const match =
          items.find(
            (c) =>
              c.code.toLowerCase() === normalized ||
              c.id.toLowerCase() === normalized,
          ) ??
          items.find((c) => {
            const hay = `${c.code} ${c.name} ${c.shortName ?? ''} ${c.description ?? ''}`
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '');
            return hay.includes(normalized);
          });

        if (!match) {
          return {
            found: false,
            message: `Aucun protocole actif trouvé pour "${raw}".`,
          };
        }

        return {
          found: true,
          protocol: {
            id: match.id,
            code: match.code,
            name: match.name,
            shortName: match.shortName || match.name,
            categoryGroup: match.categoryGroup,
            defaultUrgency: match.defaultUrgency,
            defaultSlaHours: match.defaultSlaHours,
            description: match.description,
            legalNotice: match.legalNotice,
            steps: match.steps.map((s) => ({
              stepNumber: s.stepNumber,
              title: s.title,
              description: s.description,
              recommendedDelay: s.recommendedDelay,
              responsibleRole: s.responsibleRole,
              requiredDocs: s.requiredDocs,
            })),
          },
        };
      },
    });
  }
}
