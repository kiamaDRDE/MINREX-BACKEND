import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  ActionCardDto,
  ChatResponseDto,
  ChatSourceDto,
} from './dto/chat-response.dto.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { LLMMessage } from './providers/llm-provider.interface.js';
import {
  KnowledgeRetrieverService,
  RetrievedPassage,
} from './rag/knowledge-retriever.service.js';
import { ChatbotActionValidatorService } from './safety/chatbot-action-validator.service.js';
import { ChatbotResponseValidatorService } from './safety/chatbot-response-validator.service.js';
import { ChatbotToolRegistry } from './tools/chatbot-tool.registry.js';

interface ConversationSession {
  id: string;
  userId: string;
  messages: LLMMessage[];
  lastActive: number;
}

const PURE_GREETING_PATTERN =
  /^(bonjour|bonsoir|salut|hello|hi|hey|coucou|yo|good morning|good afternoon|good evening|bjr|bsr|slt|salam|mbote|mbolo)([!\s,.?]*|(\s+(a tous|monsieur|madame|assistant|minrex|robot|bot|chere?|compatriote|tout le monde|ca va|comment ca va|comment allez[- ]vous)[!\s,.?]*))$/i;

const IDENTITY_INTRO_PATTERN =
  /^(qui es[- ]?tu|tu es qui|presente[- ]?toi|vous etes qui|qui etes[- ]?vous|que peux[- ]?tu faire|comment peux[- ]?tu m[' ]aider|a quoi sers[- ]?tu|who are you|what can you do|comment ca va|ca va)[!\s,.?]*$/i;

const THANKS_FAREWELL_PATTERN =
  /^(merci(\s+beaucoup|\s+infiniment|\s+bien)?|thanks?(\s+a\s+lot|\s+you)?|au revoir|a bientot|bonne journee|bonne soiree|bye|goodbye|parfait merci|super merci|d'accord merci|ok merci)[!\s,.?]*$/i;

@Injectable()
export class ChatbotOrchestratorService {
  private readonly logger = new Logger(ChatbotOrchestratorService.name);
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_SESSIONS = 500;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiProvider: GeminiProvider,
    private readonly toolRegistry: ChatbotToolRegistry,
    private readonly knowledgeRetriever: KnowledgeRetrieverService,
    private readonly actionValidator: ChatbotActionValidatorService,
    private readonly responseValidator: ChatbotResponseValidatorService,
  ) {}

  /**
   * Traitement principal du message utilisateur
   */
  async handleUserMessage(params: {
    userId: string;
    message: string;
    conversationId?: string;
    currentRoute?: string;
  }): Promise<ChatResponseDto> {
    const { userId, message, currentRoute } = params;
    const conversationId = params.conversationId || randomUUID();

    this.cleanupExpiredSessions();

    const session = this.getOrCreateSession(conversationId, userId);

    // 1. Détection rapide des politesses pures / salutations / présentations / remerciements
    const politenessResult = this.tryHandlePolitenessIntent(
      message,
      currentRoute,
    );
    if (politenessResult) {
      const sanitizedReply = this.responseValidator.sanitizeReply(
        politenessResult.reply,
      );
      this.appendSessionHistory(session, message, sanitizedReply);

      return {
        conversationId,
        reply: sanitizedReply,
        suggestedFollowUps: politenessResult.suggestedFollowUps,
      };
    }

    // 2. Recherche documentaire RAG (corpus souverain + protocoles d'assistance BD actifs)
    const retrievedPassages =
      await this.knowledgeRetriever.retrieveRelevantDocs(message, 3);

    const sources: ChatSourceDto[] = retrievedPassages.map((p) => ({
      title: p.document.title,
      reference: p.document.reference,
      updatedAt: p.document.updatedAt,
    }));

    const actionCards: ActionCardDto[] = [];
    let reply = '';
    let suggestedFollowUps: string[] = [];

    const apiKey =
      this.configService.get<string>('AI_API_KEY') ||
      this.configService.get<string>('GEMINI_API_KEY');

    // 3. Exécution avec IA (Gemini) ou repli déterministe souverain
    if (apiKey) {
      try {
        const aiResult = await this.executeWithLLM({
          session,
          userMessage: message,
          retrievedPassages,
          userId,
          currentRoute,
        });

        reply = aiResult.reply;
        if (aiResult.actionCards) {
          actionCards.push(...aiResult.actionCards);
        }
        if (aiResult.sources) {
          sources.push(...aiResult.sources);
        }
        suggestedFollowUps = aiResult.suggestedFollowUps;
      } catch (err: unknown) {
        this.logger.warn(
          `Échec de l'appel LLM (${err instanceof Error ? err.message : String(err)}). Activation du repli déterministe.`,
        );
        const fallback = await this.executeFallback({
          userId,
          userMessage: message,
          retrievedPassages,
          currentRoute,
        });
        reply = fallback.reply;
        actionCards.push(...fallback.actionCards);
        suggestedFollowUps = fallback.suggestedFollowUps;
      }
    } else {
      this.logger.log(
        'Clé AI non configurée. Traitement en mode souverain déterministe.',
      );
      const fallback = await this.executeFallback({
        userId,
        userMessage: message,
        retrievedPassages,
        currentRoute,
      });
      reply = fallback.reply;
      actionCards.push(...fallback.actionCards);
      suggestedFollowUps = fallback.suggestedFollowUps;
    }

    // 4. Dérivation automatique de cartes d'action contextuelles si absentes
    if (actionCards.length === 0) {
      this.deriveContextualActionCards(message, actionCards, retrievedPassages);
    }

    // 5. Validation et filtrage de sécurité
    const sanitizedReply = this.responseValidator.sanitizeReply(reply);
    const validatedSources = this.responseValidator.validateSources(sources);
    const validatedActionCards =
      this.actionValidator.validateAndFilterActionCards(actionCards);

    if (suggestedFollowUps.length === 0) {
      suggestedFollowUps = this.generateDefaultSuggestions(currentRoute);
    }

    this.appendSessionHistory(session, message, sanitizedReply);

    return {
      conversationId,
      reply: sanitizedReply,
      sources: validatedSources.length > 0 ? validatedSources : undefined,
      actionCards:
        validatedActionCards.length > 0 ? validatedActionCards : undefined,
      suggestedFollowUps,
    };
  }

  /**
   * Suggestions dynamiques pour l'accueil de l'assistant
   */
  async getSuggestions(_userId: string, currentRoute?: string): Promise<{
    welcomeMessage: string;
    suggestions: string[];
  }> {
    let welcomeMessage =
      'Bonjour et bienvenue sur l’Assistant Numérique du MINREX. Je suis là pour vous orienter dans vos démarches consulaires, votre recensement et vos besoins d’assistance.';

    if (currentRoute?.includes('/recensement')) {
      welcomeMessage =
        'Vous êtes dans l’espace Recensement consulaire. Avez-vous une question sur votre immatriculation ou la délivrance de votre carte ?';
    } else if (currentRoute?.includes('/assistance')) {
      welcomeMessage =
        'Vous êtes dans l’espace Assistance consulaire. Je peux vous présenter les protocoles officiels, vérifier vos dossiers en cours ou préparer une demande d’urgence.';
    } else if (currentRoute?.includes('/associations')) {
      welcomeMessage =
        'Bienvenue dans l’espace Communautés & Associations camerounaises à l’étranger. Vous pouvez inscrire une association ou trouver la communauté de votre région.';
    }

    const suggestions = this.generateDefaultSuggestions(currentRoute);

    return {
      welcomeMessage,
      suggestions,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Gestion des Politesses, Salutations et Présentation
  // ─────────────────────────────────────────────────────────────────────────

  private tryHandlePolitenessIntent(
    rawMessage: string,
    currentRoute?: string,
  ): { reply: string; suggestedFollowUps: string[] } | null {
    const normalized = rawMessage
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (THANKS_FAREWELL_PATTERN.test(normalized)) {
      return {
        reply:
          `Avec grand plaisir, cher compatriote !\n\n` +
          `Je reste disponible à tout moment si vous avez besoin d'aide pour votre recensement, un protocole d'assistance consulaire ou les coordonnées de votre Ambassade ou Consulat. Bonne continuation !`,
        suggestedFollowUps: this.generateDefaultSuggestions(currentRoute),
      };
    }

    if (IDENTITY_INTRO_PATTERN.test(normalized)) {
      return {
        reply:
          `### Bonjour ! Je suis l’Assistant Numérique Souverain du MINREX\n\n` +
          `Je représente le guichet d'orientation numérique du **Ministère des Relations Extérieures de la République du Cameroun (PNMD-CMR)**.\n\n` +
          `Voici comment je peux vous aider dès maintenant :\n` +
          `- **Votre Recensement Consulaire (MRD) :** vérifier le statut de votre dossier et vous guider pour votre immatriculation ;\n` +
          `- **Assistance & Protocoles d’Urgence (MAP) :** consulter tous les protocoles officiels à jour (arrestation, perte de passeport, maladie, décès, crise, aides sociales…) et suivre vos demandes ;\n` +
          `- **Réseau Diplomatique :** identifier l’Ambassade ou le Consulat compétent selon votre pays de résidence ;\n` +
          `- **Associations & Démarches :** vous informer sur les textes officiels et procédures consulaires.\n\n` +
          `*Par sécurité, je n'accède qu'aux informations de votre propre session.* Comment puis-je vous accompagner aujourd'hui ?`,
        suggestedFollowUps: this.generateDefaultSuggestions(currentRoute),
      };
    }

    if (PURE_GREETING_PATTERN.test(normalized)) {
      const hour = new Date().getHours();
      const salutation =
        hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';

      return {
        reply:
          `${salutation} et bienvenue ! Je suis **l’Assistant Numérique du MINREX** (Plateforme Nationale de Mobilisation de la Diaspora camerounaise).\n\n` +
          `Je peux vous renseigner sur **les protocoles d'assistance consulaire**, vérifier **l'état de votre recensement ou de vos demandes d'assistance**, ou trouver **votre Ambassade / Consulat de rattachement**.\n\n` +
          `Que puis-je faire pour vous aujourd'hui ?`,
        suggestedFollowUps: this.generateDefaultSuggestions(currentRoute),
      };
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Mécanismes Internes d'Orchestration
  // ─────────────────────────────────────────────────────────────────────────

  private async executeWithLLM(params: {
    session: ConversationSession;
    userMessage: string;
    retrievedPassages: RetrievedPassage[];
    userId: string;
    currentRoute?: string;
  }): Promise<{
    reply: string;
    actionCards?: ActionCardDto[];
    sources?: ChatSourceDto[];
    suggestedFollowUps: string[];
  }> {
    const { session, userMessage, retrievedPassages, userId } = params;

    const systemPrompt = this.buildSystemPrompt(retrievedPassages);
    const toolDefinitions = this.toolRegistry.getToolDefinitions();

    const conversationHistory: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...session.messages,
      { role: 'user', content: userMessage },
    ];

    const firstTurn = await this.geminiProvider.generate({
      messages: conversationHistory,
      tools: toolDefinitions,
      temperature: 0.2,
      maxTokens: 1200,
    });

    const actionCards: ActionCardDto[] = [];
    const extraSources: ChatSourceDto[] = [];

    if (firstTurn.toolCalls && firstTurn.toolCalls.length > 0) {
      conversationHistory.push({
        role: 'assistant',
        content: firstTurn.text || 'Exécution de la vérification consulaire...',
        toolCalls: firstTurn.toolCalls,
      });

      for (const call of firstTurn.toolCalls) {
        this.logger.log(`Exécution de l'outil souverain : ${call.name}`);
        const toolResult = await this.toolRegistry.executeTool(
          call.name,
          call.args,
          { userId, conversationId: session.id },
        );

        if (call.name === 'getMyCensusStatus') {
          actionCards.push({
            type: 'VIEW_CENSUS',
            title: 'Accéder à mon Recensement',
            description:
              'Consultez votre fiche officielle d’immatriculation consulaire.',
            actionUrl: '/espace/recensement',
          });
        } else if (call.name === 'getMyAssistanceCases') {
          actionCards.push({
            type: 'VIEW_ASSISTANCE_CASE',
            title: 'Mes Dossiers d’Assistance',
            description:
              'Consultez le suivi en temps réel de vos requêtes de protection.',
            actionUrl: '/espace/assistance',
          });
        } else if (call.name === 'getAssistanceProtocolDetails') {
          const proto = toolResult.protocol as
            | { id?: string; code?: string; shortName?: string; defaultUrgency?: string }
            | undefined;
          if (proto?.code) {
            actionCards.push({
              type: 'PREFILL_ASSISTANCE',
              title: `Déclarer : ${proto.shortName || proto.code}`,
              description:
                'Ouvrir le formulaire pré-rempli avec ce protocole officiel MINREX.',
              actionUrl: '/espace/assistance',
              prefillData: {
                categoryId: proto.id,
                categoryCode: proto.code,
                urgency: proto.defaultUrgency,
              },
            });
          }
        } else if (call.name === 'findDiplomaticPost') {
          actionCards.push({
            type: 'VIEW_DIPLOMATIC_POST',
            title: 'Espace Assistance & Postes',
            description:
              'Accédez à vos démarches et coordonnées consulaires.',
            actionUrl: '/espace/assistance',
          });
        }

        conversationHistory.push({
          role: 'tool',
          name: call.name,
          content: JSON.stringify(toolResult),
        });
      }

      const secondTurn = await this.geminiProvider.generate({
        messages: conversationHistory,
        temperature: 0.2,
        maxTokens: 1200,
      });

      return {
        reply: secondTurn.text,
        actionCards,
        sources: extraSources,
        suggestedFollowUps: this.extractSuggestionsFromReply(
          secondTurn.text,
          userMessage,
        ),
      };
    }

    return {
      reply: firstTurn.text,
      actionCards,
      suggestedFollowUps: this.extractSuggestionsFromReply(
        firstTurn.text,
        userMessage,
      ),
    };
  }

  /**
   * Repli déterministe et souverain garanti sans dépendance externe
   */
  private async executeFallback(params: {
    userId: string;
    userMessage: string;
    retrievedPassages: RetrievedPassage[];
    currentRoute?: string;
  }): Promise<{
    reply: string;
    actionCards: ActionCardDto[];
    suggestedFollowUps: string[];
  }> {
    const { userId, userMessage, retrievedPassages } = params;
    const lower = userMessage
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const actionCards: ActionCardDto[] = [];

    // Intention 1 : Liste complète des protocoles d'assistance actifs en BD
    if (
      (lower.includes('protocole') || lower.includes('categorie') || lower.includes('procedure')) &&
      (lower.includes('liste') ||
        lower.includes('quels') ||
        lower.includes('tous') ||
        lower.includes('disponible') ||
        lower.includes('assistance'))
    ) {
      const protocolDocs =
        await this.knowledgeRetriever.getActiveProtocolDocs();

      if (protocolDocs.length > 0) {
        let reply = `### Protocoles Officiels d’Assistance Consulaire (${protocolDocs.length} actifs)\n\n`;
        reply += `Voici les procédures d'assistance et de protection actuellement en vigueur sur la plateforme MINREX :\n\n`;
        for (const p of protocolDocs) {
          reply += `- ${p.protocolMeta.icon} **${p.protocolMeta.shortName}** (*${p.protocolMeta.categoryGroup}* · SLA : **${p.protocolMeta.defaultSlaHours} h** · ${p.protocolMeta.steps.length} étape(s))\n`;
        }
        reply += `\nDemandez-moi le détail d'un protocole précis ou déclarez une demande directement depuis votre espace assistance.`;

        actionCards.push({
          type: 'PREFILL_ASSISTANCE',
          title: 'Ouvrir une demande d’assistance',
          description:
            'Sélectionner un protocole officiel et transmettre votre signalement.',
          actionUrl: '/espace/assistance',
        });

        return {
          reply,
          actionCards,
          suggestedFollowUps: protocolDocs
            .slice(0, 3)
            .map((p) => `Détails du protocole : ${p.protocolMeta.shortName}`),
        };
      }
    }

    // Intention 2 : Correspondance forte avec un protocole dynamique BD (y compris nouveaux protocoles créés par l'Admin !)
    const topProtocolPassage = retrievedPassages.find(
      (p) => p.protocolMeta && p.score >= 6,
    );
    if (
      topProtocolPassage?.protocolMeta &&
      !lower.includes('mes dossiers') &&
      !lower.includes('statut de ma demande')
    ) {
      const meta = topProtocolPassage.protocolMeta;
      const reply =
        `### ${topProtocolPassage.document.title}\n\n` +
        `**Référence :** *${topProtocolPassage.document.reference}* · **SLA cible :** ${meta.defaultSlaHours} h\n\n` +
        `${topProtocolPassage.document.content}\n\n` +
        `> Vous pouvez initier immédiatement ce protocole via le formulaire pré-rempli ci-dessous.`;

      actionCards.push({
        type: 'PREFILL_ASSISTANCE',
        title: `Déclarer : ${meta.shortName}`,
        description: `Pré-remplir une demande d'assistance (${meta.categoryGroup}, SLA ${meta.defaultSlaHours} h).`,
        actionUrl: '/espace/assistance',
        prefillData: {
          categoryId: meta.categoryId,
          categoryCode: meta.code,
          urgency: meta.defaultUrgency,
        },
      });

      return {
        reply,
        actionCards,
        suggestedFollowUps: [
          'Quels sont mes dossiers d’assistance en cours ?',
          'Quels sont tous les protocoles d’assistance disponibles ?',
          'Quelle est mon Ambassade de rattachement ?',
        ],
      };
    }

    // Intention 3 : Recensement / Carte consulaire
    if (
      lower.includes('recensement') ||
      lower.includes('immatriculation') ||
      lower.includes('carte consulaire') ||
      (lower.includes('statut') && !lower.includes('assistance'))
    ) {
      const censusData = (await this.toolRegistry.executeTool(
        'getMyCensusStatus',
        {},
        { userId, conversationId: 'fallback' },
      )) as {
        hasRecord?: boolean;
        status?: string | null;
        reference?: string | null;
        assignedPost?: string | null;
        residenceCountry?: string | null;
        residenceCity?: string | null;
      };

      let reply = '';
      if (censusData.hasRecord) {
        reply =
          `### Statut de votre Recensement Consulaire\n\n` +
          `Votre dossier d’immatriculation consulaire est actuellement au statut **${censusData.status ?? 'INCONNU'}**.\n\n` +
          `- **Numéro d'immatriculation / Référence :** \`${censusData.reference ?? 'En cours d’attribution'}\`\n` +
          `- **Poste de rattachement :** ${censusData.assignedPost ?? 'Non spécifié'}\n` +
          `- **Pays de résidence :** ${censusData.residenceCountry ?? 'Non spécifié'} (${censusData.residenceCity ?? 'N/A'})\n\n` +
          `Pour consulter votre attestation ou mettre à jour vos justificatifs, utilisez l'accès direct ci-dessous.`;
      } else {
        reply =
          `### Recensement Consulaire MINREX\n\n` +
          `Vous n’avez pas encore initié de dossier de recensement consulaire sur la plateforme.\n\n` +
          `Le recensement consulaire (Décret N° 2013/112) permet :\n` +
          `1. La délivrance de votre **carte d'immatriculation consulaire** sécurisée ;\n` +
          `2. Votre protection consulaire et assistance prioritaire en cas d’urgence ;\n` +
          `3. La facilitation de vos démarches d'état civil et de passeport à l'étranger.\n\n` +
          `Vous pouvez démarrer votre inscription dès maintenant via votre espace citoyen.`;
      }

      actionCards.push({
        type: 'VIEW_CENSUS',
        title: 'Accéder à mon dossier de Recensement',
        description: 'Démarrer ou consulter votre immatriculation consulaire.',
        actionUrl: '/espace/recensement',
      });

      return {
        reply,
        actionCards,
        suggestedFollowUps: [
          'Quelles pièces fournir pour la carte consulaire ?',
          'Quels sont tous les protocoles d’assistance disponibles ?',
          'Comment déclarer une urgence consulaire ?',
        ],
      };
    }

    // Intention 4 : Dossiers d'assistance personnels
    if (
      lower.includes('assistance') ||
      lower.includes('urgence') ||
      lower.includes('dossier') ||
      lower.includes('rapatriement') ||
      lower.includes('arrestation') ||
      lower.includes('avocat')
    ) {
      const assistanceData = (await this.toolRegistry.executeTool(
        'getMyAssistanceCases',
        {},
        { userId, conversationId: 'fallback' },
      )) as {
        hasCases?: boolean;
        total?: number;
        cases?: Array<{
          reference: string;
          subject: string;
          status: string;
          urgency: string;
        }>;
      };

      let reply = '';
      if (assistanceData.hasCases && Array.isArray(assistanceData.cases)) {
        reply =
          `### Vos Demandes de Protection et d’Assistance Consulaire\n\n` +
          `Vous avez actuellement **${assistanceData.total} dossier(s)** d'assistance consulaire enregistré(s) :\n\n`;

        for (const c of assistanceData.cases.slice(0, 3)) {
          reply += `- **Réf :** \`${c.reference}\` — **Objet :** ${c.subject} (Statut : *${c.status}*, Urgence : *${c.urgency}*)\n`;
        }
        reply += `\nNos agents consulaires assurent le traitement prioritaire selon le protocole applicable.`;
      } else {
        const protocolDocs =
          await this.knowledgeRetriever.getActiveProtocolDocs();
        reply =
          `### Service d’Assistance Consulaire et d’Urgence (MAP)\n\n` +
          `Aucun dossier actif n'a été trouvé à votre nom. En cas de détresse, le MINREX active ses **${protocolDocs.length} protocoles officiels** (arrestation, maladie/accident, décès, perte de documents, crise majeure, disparition, secours d'urgence…).\n\n` +
          `Vous pouvez déposer un signalement prioritaire immédiatement ci-dessous.`;
      }

      actionCards.push({
        type: 'PREFILL_ASSISTANCE',
        title: 'Déclarer une Urgence Consulaire',
        description:
          'Transmettre un signalement prioritaire aux agents consulaires.',
        actionUrl: '/espace/assistance',
      });

      return {
        reply,
        actionCards,
        suggestedFollowUps: [
          'Quels sont tous les protocoles d’assistance disponibles ?',
          'Que faire en cas d’arrestation à l’étranger ?',
          'Procédure en cas de perte de passeport à l’étranger',
        ],
      };
    }

    // Intention 5 : RAG trouvé dans le corpus documentaire statique ou dynamique
    if (retrievedPassages.length > 0 && retrievedPassages[0]!.score >= 3) {
      const topDoc = retrievedPassages[0]!.document;
      const reply =
        `### ${topDoc.title}\n\n` +
        `**Référence officielle :** *${topDoc.reference}* (Validé au ${topDoc.updatedAt})\n\n` +
        `${topDoc.summary}\n\n` +
        `${topDoc.content}\n\n` +
        `> Pour toute question complémentaire, nos postes diplomatiques sont habilités à vous recevoir.`;

      if (topDoc.officialLink) {
        actionCards.push({
          type: 'OPEN_INTERNAL_ROUTE',
          title: 'Accéder au service dédié',
          description: 'Consulter la rubrique officielle MINREX',
          actionUrl: topDoc.officialLink,
        });
      }

      return {
        reply,
        actionCards,
        suggestedFollowUps: [
          'Quel est le statut de mon recensement ?',
          'Quels sont tous les protocoles d’assistance disponibles ?',
          'Où consulter les associations camerounaises ?',
        ],
      };
    }

    // Réponse d'orientation par défaut (courtoise et claire)
    const defaultReply =
      `### Assistant Numérique MINREX\n\n` +
      `Je n'ai pas identifié de procédure précise pour votre message, mais je peux vous accompagner sur les sujets suivants :\n\n` +
      `- **Recensement & Immatriculation (MRD) :** statut de votre dossier et carte consulaire ;\n` +
      `- **Protection & Urgences (MAP) :** protocoles d'assistance officiels à jour et suivi de vos demandes ;\n` +
      `- **Réseau Diplomatique :** Ambassade ou Consulat compétent selon votre pays ;\n` +
      `- **Associations de la Diaspora (MCA) :** inscription et annuaire des associations reconnues.\n\n` +
      `Essayez par exemple : *« Quels sont les protocoles d'assistance ? »* ou *« Où en est mon recensement ? »*.`;

    actionCards.push({
      type: 'OPEN_INTERNAL_ROUTE',
      title: 'Mon Espace Consulaire',
      description: 'Accédez à votre tableau de bord citoyen.',
      actionUrl: '/espace/assistance',
    });

    return {
      reply: defaultReply,
      actionCards,
      suggestedFollowUps: this.generateDefaultSuggestions(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Méthodes Utilitaires & Prompting
  // ─────────────────────────────────────────────────────────────────────────

  private buildSystemPrompt(retrievedPassages: RetrievedPassage[]): string {
    let ragContext = '';
    if (retrievedPassages.length > 0) {
      ragContext =
        '\n\n=== CORPUS DOCUMENTAIRE SOUVERAIN OFFICIEL & PROTOCOLES BD ACTIFS ===\n' +
        retrievedPassages
          .map(
            (p, idx) =>
              `[Document ${idx + 1}] Titre : ${p.document.title}\nRéférence : ${p.document.reference} (Mise à jour : ${p.document.updatedAt})\nRésumé : ${p.document.summary}\nContenu : ${p.document.content}\nLien : ${p.document.officialLink || 'N/A'}\n`,
          )
          .join('\n---\n');
    }

    return (
      `Vous êtes l'Assistant Numérique Souverain du Ministère des Relations Extérieures de la République du Cameroun (MINREX).\n` +
      `Votre mission régalienne est d'accueillir, d'orienter, d'informer et de protéger les membres de la diaspora camerounaise avec rigueur, courtoisie et bienveillance.\n\n` +
      `DIRECTIVES DE CONVERSATION, DE SÉCURITÉ ET DE SOUVERAINETÉ :\n` +
      `1. ACCUEIL & COURTOISIE : Répondez chaleureusement aux formules de politesse (« Bonjour », « Salut », « Hello », « Merci », « Qui es-tu ? ») et sachez vous présenter clairement comme l'Assistant Numérique du MINREX (PNMD-CMR).\n` +
      `2. VÉRITÉ ADMINISTRATIVE & PROTOCOLES BD : Fondez vos réponses EXCLUSIVEMENT sur le corpus officiel ci-dessous et sur les outils autorisés (getMyCensusStatus, getMyAssistanceCases, findDiplomaticPost, searchApprovedProcedures, listAssistanceProtocols, getAssistanceProtocolDetails). Pour tout protocole d'assistance, consultez toujours les données à jour issues de la base de données.\n` +
      `3. HONNÊTETÉ ET LIMITES : Si une information ne figure ni dans les documents officiels ni dans les outils, dites-le avec courtoisie et orientez l'usager vers son Ambassade ou Consulat Général.\n` +
      `4. CONFIDENTIALITÉ STRICTE : N'inventez jamais de données personnelles et n'exposez jamais les données d'un autre utilisateur. Vous n'avez accès qu'aux données de la session connectée.\n` +
      `5. NON-MUTATION DE LA BD : Vous êtes un assistant d'orientation en lecture seule. Vous orientez vers les formulaires sécurisés du portail.\n` +
      `6. STYLE RÉGALIEN : Rédigez en Markdown clair, concis et aéré.\n` +
      ragContext
    );
  }

  private deriveContextualActionCards(
    message: string,
    cards: ActionCardDto[],
    retrievedPassages: RetrievedPassage[],
  ) {
    const lower = message.toLowerCase();

    const matchedProto = retrievedPassages.find((p) => p.protocolMeta);
    if (matchedProto?.protocolMeta) {
      const meta = matchedProto.protocolMeta;
      cards.push({
        type: 'PREFILL_ASSISTANCE',
        title: `Déclarer : ${meta.shortName}`,
        description: `Ouvrir le formulaire pré-rempli (${meta.categoryGroup}, SLA ${meta.defaultSlaHours} h).`,
        actionUrl: '/espace/assistance',
        prefillData: {
          categoryId: meta.categoryId,
          categoryCode: meta.code,
          urgency: meta.defaultUrgency,
        },
      });
      return;
    }

    if (
      lower.includes('recensement') ||
      lower.includes('carte consulaire') ||
      lower.includes('immatriculation')
    ) {
      cards.push({
        type: 'VIEW_CENSUS',
        title: 'Accéder à mon Recensement',
        description: 'Vérifiez ou complétez votre immatriculation consulaire.',
        actionUrl: '/espace/recensement',
      });
    }

    if (
      lower.includes('assistance') ||
      lower.includes('urgence') ||
      lower.includes('décès') ||
      lower.includes('perte')
    ) {
      cards.push({
        type: 'PREFILL_ASSISTANCE',
        title: 'Signaler une Urgence Consulaire',
        description: 'Transmettre votre demande de protection prioritaire.',
        actionUrl: '/espace/assistance',
      });
    }

    if (
      lower.includes('association') ||
      lower.includes('communauté') ||
      lower.includes('mca')
    ) {
      cards.push({
        type: 'VIEW_ASSOCIATION',
        title: 'Annuaire des Associations',
        description: 'Découvrez les associations camerounaises reconnues.',
        actionUrl: '/espace/associations',
      });
    }

    if (cards.length === 0 && retrievedPassages[0]?.document.officialLink) {
      cards.push({
        type: 'OPEN_INTERNAL_ROUTE',
        title: 'Accéder à la démarche en ligne',
        description: retrievedPassages[0].document.title,
        actionUrl: retrievedPassages[0].document.officialLink,
      });
    }
  }

  private extractSuggestionsFromReply(
    _reply: string,
    userMessage: string,
  ): string[] {
    const lower = userMessage.toLowerCase();
    if (lower.includes('recensement') || lower.includes('carte')) {
      return [
        'Quels documents fournir pour la carte consulaire ?',
        'Quels sont tous les protocoles d’assistance disponibles ?',
        'Quelle est mon ambassade de rattachement ?',
      ];
    }
    if (lower.includes('assistance') || lower.includes('urgence') || lower.includes('protocole')) {
      return [
        'Quels sont tous les protocoles d’assistance disponibles ?',
        'Quels sont mes dossiers d’assistance en cours ?',
        'Que faire en cas d’arrestation à l’étranger ?',
      ];
    }
    return this.generateDefaultSuggestions();
  }

  private generateDefaultSuggestions(currentRoute?: string): string[] {
    if (currentRoute?.includes('/recensement')) {
      return [
        'Quel est le statut de mon recensement ?',
        'Comment obtenir ma carte consulaire ?',
        'Quels justificatifs de domicile sont acceptés ?',
      ];
    }
    if (currentRoute?.includes('/assistance')) {
      return [
        'Quels sont tous les protocoles d’assistance disponibles ?',
        'Quels sont mes dossiers d’assistance en cours ?',
        'Procédure en cas de perte de passeport à l’étranger',
      ];
    }
    if (currentRoute?.includes('/associations')) {
      return [
        'Comment inscrire mon association au registre MINREX ?',
        'Quels sont les critères de validation d’une association ?',
        'Trouver une association camerounaise près de chez moi',
      ];
    }

    return [
      'Quels sont tous les protocoles d’assistance disponibles ?',
      'Quel est le statut de mon recensement consulaire ?',
      'Comment renouveler mon passeport camerounais ?',
      'Comment déclarer une urgence consulaire ?',
    ];
  }

  private appendSessionHistory(
    session: ConversationSession,
    userMessage: string,
    assistantReply: string,
  ): void {
    session.messages.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantReply },
    );
    if (session.messages.length > 10) {
      session.messages = session.messages.slice(-10);
    }
    session.lastActive = Date.now();
  }

  private getOrCreateSession(
    conversationId: string,
    userId: string,
  ): ConversationSession {
    let session = this.sessions.get(conversationId);
    if (!session || session.userId !== userId) {
      if (this.sessions.size >= this.MAX_SESSIONS) {
        let oldestKey: string | null = null;
        let oldestTs = Infinity;
        for (const [key, item] of this.sessions.entries()) {
          if (item.lastActive < oldestTs) {
            oldestTs = item.lastActive;
            oldestKey = key;
          }
        }
        if (oldestKey) {
          this.sessions.delete(oldestKey);
        }
      }

      session = {
        id: conversationId,
        userId,
        messages: [],
        lastActive: Date.now(),
      };
      this.sessions.set(conversationId, session);
    }
    session.lastActive = Date.now();
    return session;
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > this.SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
