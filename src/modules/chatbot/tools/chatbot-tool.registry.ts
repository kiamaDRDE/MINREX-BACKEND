import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import { CensusService } from '../../census/census.service.js';
import { AssistanceService } from '../../assistance/assistance.service.js';
import { KnowledgeRetrieverService } from '../rag/knowledge-retriever.service.js';
import {
  ChatbotTool,
  ChatbotToolContext,
} from './chatbot-tool.interface.js';
import { LLMToolDefinition } from '../providers/llm-provider.interface.js';

@Injectable()
export class ChatbotToolRegistry {
  private readonly logger = new Logger(ChatbotToolRegistry.name);
  private readonly tools = new Map<string, ChatbotTool>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly censusService: CensusService,
    private readonly assistanceService: AssistanceService,
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
    } catch (err: any) {
      this.logger.error(`Erreur d'exécution de l'outil ${name}: ${err?.message}`);
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

    // ── Outil 2 : Statut des demandes d'assistance consulaire ──
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
        const casesRes = await this.assistanceService.findMyCases(context.userId);
        const cases = casesRes.items;
        if (!cases || cases.length === 0) {
          return {
            hasCases: false,
            cases: [],
            message: 'Aucun dossier d’assistance en cours pour ce membre.',
          };
        }

        // Minimisation stricte : aucune note interne d'agent n'est exposée
        return {
          hasCases: true,
          total: cases.length,
          cases: cases.map((c: any) => ({
            reference: c.id,
            status: c.status,
            subject: c.subject,
            city: c.city || null,
            country: c.country?.name || null,
            assignedPost: c.assignedPost?.name || null,
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
              description: 'Nom ou code du pays de résidence (ex: France, Allemagne, USA, Gabon)',
            },
            city: {
              type: 'string',
              description: 'Ville de résidence optionnelle (ex: Paris, Marseille, Berlin, Washington)',
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
          take: 3,
        });

        if (coverages.length === 0) {
          return {
            found: false,
            message: `Aucune représentation diplomatique active trouvée pour le pays : ${countryQuery}.`,
          };
        }

        return {
          found: true,
          country: coverages[0].country.name,
          posts: coverages.map((c) => ({
            name: c.post.name,
            code: c.post.code,
            type: c.post.type?.name || 'Missions diplomatiques',
            city: c.post.city || null,
            address: c.post.address || null,
          })),
        };
      },
    });

    // ── Outil 4 : Recherche dans les procédures officielles approuvées ──
    this.tools.set('searchApprovedProcedures', {
      definition: {
        name: 'searchApprovedProcedures',
        description:
          'Recherche les démarches, textes de lois, délais SLA et conditions légales dans le corpus documentaire approuvé du MINREX.',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Thème recherché (ex: passeport, laissez-passer, décès, arrestation, association)',
            },
          },
          required: ['topic'],
        },
      },
      execute: async (args) => {
        const topicVal = typeof args.topic === 'string' ? args.topic : '';
        const topic = topicVal.trim();
        const results = await this.knowledgeRetriever.retrieveRelevantDocs(topic, 2);

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
  }
}
