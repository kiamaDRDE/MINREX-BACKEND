import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  ActionCardDto,
  ChatResponseDto,
  ChatSourceDto,
} from './dto/chat-response.dto.js';
import {
  LLMMessage,
} from './providers/llm-provider.interface.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import {
  KnowledgeRetrieverService,
  RetrievedPassage,
} from './rag/knowledge-retriever.service.js';
import { ChatbotToolRegistry } from './tools/chatbot-tool.registry.js';
import { ChatbotActionValidatorService } from './safety/chatbot-action-validator.service.js';
import { ChatbotResponseValidatorService } from './safety/chatbot-response-validator.service.js';

interface ConversationSession {
  id: string;
  userId: string;
  messages: LLMMessage[];
  lastActive: number;
}

@Injectable()
export class ChatbotOrchestratorService {
  private readonly logger = new Logger(ChatbotOrchestratorService.name);
  private readonly sessions = new Map<string, ConversationSession>();
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

    // Nettoyage régulier des sessions expirées
    this.cleanupExpiredSessions();

    // 1. Récupération ou initialisation de la session
    const session = this.getOrCreateSession(conversationId, userId);

    // 2. Recherche documentaire RAG dans le corpus souverain
    const retrievedPassages = await this.knowledgeRetriever.retrieveRelevantDocs(
      message,
      3,
    );

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

    // 3. Exécution avec IA (Gemini) ou repli déterministe
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
      } catch (err: any) {
        this.logger.warn(
          `Échec de l'appel LLM (${err?.message}). Activation du repli déterministe.`,
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

    // 5. Validation et filtrage de sécurité (Liste blanche & Assainissement)
    const sanitizedReply = this.responseValidator.sanitizeReply(reply);
    const validatedSources = this.responseValidator.validateSources(sources);
    const validatedActionCards = this.actionValidator.validateAndFilterActionCards(
      actionCards,
    );

    // Si aucune suggestion générée, en fournir de pertinentes
    if (suggestedFollowUps.length === 0) {
      suggestedFollowUps = this.generateDefaultSuggestions(currentRoute);
    }

    // 6. Mise à jour de l'historique conversationnel
    session.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: sanitizedReply },
    );
    // Limiter la mémoire aux 10 derniers échanges
    if (session.messages.length > 10) {
      session.messages = session.messages.slice(-10);
    }
    session.lastActive = Date.now();

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
  async getSuggestions(userId: string, currentRoute?: string): Promise<{
    welcomeMessage: string;
    suggestions: string[];
  }> {
    let welcomeMessage =
      'Bienvenue sur l’Assistant Numérique MINREX. Comment puis-je vous accompagner dans vos démarches consulaires aujourd’hui ?';

    if (currentRoute?.includes('/recensement')) {
      welcomeMessage =
        'Vous êtes dans l’espace Recensement consulaire. Avez-vous une question sur votre immatriculation ou la délivrance de votre carte ?';
    } else if (currentRoute?.includes('/assistance')) {
      welcomeMessage =
        'Vous êtes dans l’espace Assistance consulaire. Vous pouvez signaler une situation d’urgence ou suivre l’état de vos demandes de protection.';
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

    // Appel 1 : Le modèle analyse le message et décide d'appeler un outil ou de répondre
    const firstTurn = await this.geminiProvider.generate({
      messages: conversationHistory,
      tools: toolDefinitions,
      temperature: 0.2,
      maxTokens: 1200,
    });

    const actionCards: ActionCardDto[] = [];
    const extraSources: ChatSourceDto[] = [];

    // Si le modèle sollicite des outils de la liste blanche
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

        // Associer des cartes d'action utiles selon l'outil exécuté
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
        } else if (call.name === 'findDiplomaticPost') {
          actionCards.push({
            type: 'VIEW_DIPLOMATIC_POST',
            title: 'Réseau Diplomatique',
            description:
              'Accédez à l’annuaire complet des représentations consulaires.',
            actionUrl: '/reseau-diplomatique',
          });
        }

        conversationHistory.push({
          role: 'tool',
          name: call.name,
          content: JSON.stringify(toolResult),
        });
      }

      // Appel 2 : Le modèle synthétise la réponse finale avec les données réelles obtenues
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
    const lower = userMessage.toLowerCase();
    const actionCards: ActionCardDto[] = [];

    // Intention 1 : Recensement / Carte consulaire
    if (
      lower.includes('recensement') ||
      lower.includes('consulaire') ||
      lower.includes('immatriculation') ||
      lower.includes('carte') ||
      lower.includes('statut')
    ) {
      const censusData: any = await this.toolRegistry.executeTool(
        'getMyCensusStatus',
        {},
        { userId, conversationId: 'fallback' },
      );

      let reply = '';
      if (censusData.hasRecord) {
        reply =
          `### 🇨🇲 Statut de votre Recensement Consulaire\n\n` +
          `Votre dossier d’immatriculation consulaire est actuellement au statut **${censusData.status}**.\n\n` +
          `- **Numéro d'immatriculation / Référence :** \`${censusData.reference || 'En cours d’attribution'}\`\n` +
          `- **Poste de rattachement :** ${censusData.assignedPost || 'Non spécifié'}\n` +
          `- **Pays de résidence :** ${censusData.residenceCountry || 'Non spécifié'} (${censusData.residenceCity || 'N/A'})\n\n` +
          `Pour consulter votre attestation ou mettre à jour vos justificatifs, utilisez l'accès direct ci-dessous.`;
      } else {
        reply =
          `### 📋 Recensement Consulaire MINREX\n\n` +
          `Vous n’avez pas encore initié de dossier de recensement consulaire sur la plateforme.\n\n` +
          `Le recensement consulaire est une démarche légale fondamentale (Décret N° 2013/112) permettant :\n` +
          `1. La délivrance de votre **carte d'immatriculation consulaire** sécurisée ;\n` +
          `2. Votre protection consulaire et assistance en cas d’urgence ;\n` +
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
          'Quels sont les frais de chancellerie ?',
          'Comment déclarer une urgence consulaire ?',
        ],
      };
    }

    // Intention 2 : Assistance / Urgence consulaire
    if (
      lower.includes('assistance') ||
      lower.includes('urgence') ||
      lower.includes('dossier') ||
      lower.includes('rapatriement') ||
      lower.includes('arrestation') ||
      lower.includes('avocat')
    ) {
      const assistanceData: any = await this.toolRegistry.executeTool(
        'getMyAssistanceCases',
        {},
        { userId, conversationId: 'fallback' },
      );

      let reply = '';
      if (assistanceData.hasCases && Array.isArray(assistanceData.cases)) {
        reply =
          `### 🛡️ Vos Demandes de Protection et d’Assistance Consulaire\n\n` +
          `Vous avez actuellement **${assistanceData.total} dossier(s)** d'assistance consulaire enregistré(s) auprès de nos services :\n\n`;

        for (const c of assistanceData.cases.slice(0, 3)) {
          reply += `- **Réf :** \`${c.reference}\` — **Objet :** ${c.subject} (Statut : *${c.status}*, Urgence : *${c.urgency}*)\n`;
        }
        reply += `\nNos agents consulaires assurent le traitement prioritaire selon le niveau d'urgence.`;
      } else {
        reply =
          `### 🛡️ Service d’Assistance Consulaire et d’Urgence (MAP)\n\n` +
          `Le Ministère des Relations Extérieures assure la protection diplomatique et consulaire des citoyens camerounais à l’étranger en cas de :\n` +
          `- **Détention ou arrestation à l'étranger** (droit d'accès consulaire - Art. 36 Convention de Vienne) ;\n` +
          `- **Décès d'un compatriote** et démarches de rapatriement de dépouille ;\n` +
          `- **Perte ou vol de documents d'identité et de voyage** (délivrance de laissez-passer) ;\n` +
          `- **Crise humanitaire, conflit ou évacuation sanitaire**.\n\n` +
          `Aucun dossier actif n'a été trouvé à votre nom. En cas de situation critique, vous pouvez créer une demande immédiatement.`;
      }

      actionCards.push({
        type: 'PREFILL_ASSISTANCE',
        title: 'Déclarer une Urgence Consulaire',
        description: 'Transmettre un signalement prioritaire aux agents consulaires.',
        actionUrl: '/espace/assistance',
      });

      return {
        reply,
        actionCards,
        suggestedFollowUps: [
          'Que faire en cas d’arrestation à l’étranger ?',
          'Procédure en cas de perte de passeport à l’étranger',
          'Numéro d’urgence de mon ambassade',
        ],
      };
    }

    // Intention 3 : RAG trouvé dans le corpus documentaire
    if (retrievedPassages.length > 0 && retrievedPassages[0].score >= 3) {
      const topDoc = retrievedPassages[0].document;
      const reply =
        `### 📄 ${topDoc.title}\n\n` +
        `**Référence officielle :** *${topDoc.reference}* (Validé au ${topDoc.updatedAt})\n\n` +
        `${topDoc.summary}\n\n` +
        `${topDoc.content}\n\n` +
        `> Pour toute question complémentaire, nos postes diplomatiques sont habilités à vous recevoir.`;

      if (topDoc.officialLink) {
        actionCards.push({
          type: 'OPEN_INTERNAL_ROUTE',
          title: 'Accéder au service dédié',
          description: `Consulter la rubrique officielle MINREX`,
          actionUrl: topDoc.officialLink,
        });
      }

      return {
        reply,
        actionCards,
        suggestedFollowUps: [
          'Quel est le statut de mon recensement ?',
          'Comment trouver mon consulat de rattachement ?',
          'Où consulter les associations camerounaises ?',
        ],
      };
    }

    // Réponse d'accueil par défaut
    const defaultReply =
      `### 🇨🇲 Bienvenue sur l’Assistant Numérique MINREX\n\n` +
      `Je suis à votre entière disposition pour vous guider dans l'ensemble de vos démarches consulaires et citoyennes :\n\n` +
      `- **Recensement & Immatriculation (MRD) :** Consultation de votre dossier et de votre carte consulaire ;\n` +
      `- **Protection & Urgences (MAP) :** Assistance en cas d'arrestation, décès, rapatriement ou perte de titres ;\n` +
      `- **Réseau Diplomatique :** Trouver les coordonnées et permanences de votre Ambassade ou Consulat ;\n` +
      `- **Associations de la Diaspora (MCA) :** Déclarer ou adhérer à une association légale reconnue ;\n` +
      `- **Publications & Communiqués (MPV) :** Suivre les avis officiels du Ministère.\n\n` +
      `Posez-moi votre question en toute simplicité (ex : *« Quels sont les frais pour un passeport ? »*, *« Où en est mon recensement ? »*).`;

    actionCards.push({
      type: 'OPEN_INTERNAL_ROUTE',
      title: 'Mon Espace Consulaire',
      description: 'Accédez à votre tableau de bord citoyen.',
      actionUrl: '/espace/recensement',
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
        '\n\n=== CORPUS DOCUMENTAIRE SOUVERAIN OFFICIEL (VÉRITÉS DE RÉFÉRENCE) ===\n' +
        retrievedPassages
          .map(
            (p, idx) =>
              `[Document ${idx + 1}] Titre : ${p.document.title}\nRéférence : ${p.document.reference} (Mise à jour : ${p.document.updatedAt})\nRésumé : ${p.document.summary}\nContenu : ${p.document.content}\nLien : ${p.document.officialLink || 'N/A'}\n`,
          )
          .join('\n---\n');
    }

    return (
      `Vous êtes l'Assistant Numérique Souverain du Ministère des Relations Extérieures de la République du Cameroun (MINREX).\n` +
      `Votre mission régalienne est d'orienter, d'informer et de protéger les membres de la diaspora camerounaise avec rigueur, courtoisie et bienveillance.\n\n` +
      `DIRECTIVES DE SÉCURITÉ ET DE SOUVERAINETÉ :\n` +
      `1. VÉRITÉ ADMINISTRATIVE : Fondez vos réponses EXCLUSIVEMENT sur le corpus officiel fourni ci-dessous et sur les outils autorisés (getMyCensusStatus, getMyAssistanceCases, findDiplomaticPost, searchApprovedProcedures).\n` +
      `2. HONNÊTETÉ ET LIMITES : Si une information ne figure ni dans les documents officiels ni dans les outils, dites avec courtoisie que le service n'est pas répertorié et orientez l'usager vers son Ambassade ou Consulat Général.\n` +
      `3. CONFIDENTIALITÉ STRICTE : N'inventez jamais de données personnelles. Pour connaître le statut de l'usager connecté, utilisez TOUJOURS getMyCensusStatus ou getMyAssistanceCases. Vous n'avez accès qu'aux données de l'usager connecté.\n` +
      `4. NON-MUTATION DE LA BD : Vous êtes un assistant d'orientation. Vous ne créez ni ne supprimez de dossiers directement. Vous orientez vers les formulaires sécurisés du portail.\n` +
      `5. STYLE RÉGALIEN : Rédigez en Markdown soigné, clair, aéré (titres, listes à puces, gras). Adressez-vous à l'usager avec respect (« Chère compatriote », « Cher compatriote » ou « Madame, Monsieur »).\n` +
      ragContext
    );
  }

  private deriveContextualActionCards(
    message: string,
    cards: ActionCardDto[],
    retrievedPassages: RetrievedPassage[],
  ) {
    const lower = message.toLowerCase();

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

    if (
      lower.includes('ambassade') ||
      lower.includes('consulat') ||
      lower.includes('représentation')
    ) {
      cards.push({
        type: 'VIEW_DIPLOMATIC_POST',
        title: 'Réseau Diplomatique',
        description: 'Consultez la carte des postes diplomatiques du Cameroun.',
        actionUrl: '/reseau-diplomatique',
      });
    }

    // Si un document avec lien officiel a été consulté
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
        'Quels sont les frais de chancellerie applicables ?',
        'Quelle est mon ambassade de rattachement ?',
      ];
    }
    if (lower.includes('assistance') || lower.includes('urgence')) {
      return [
        'Quels sont les délais de traitement d’une urgence ?',
        'Que faire en cas d’arrestation à l’étranger ?',
        'Comment obtenir un laissez-passer mortuaire ?',
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
        'Quels sont mes dossiers d’assistance en cours ?',
        'Signaler une arrestation à l’étranger',
        'Demander un laissez-passer consulaire d’urgence',
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
      'Quel est le statut de mon recensement consulaire ?',
      'Comment renouveler mon passeport camerounais ?',
      'Quelle est mon Ambassade de rattachement ?',
      'Comment déclarer une urgence consulaire ?',
    ];
  }

  private getOrCreateSession(
    conversationId: string,
    userId: string,
  ): ConversationSession {
    let session = this.sessions.get(conversationId);
    if (!session || session.userId !== userId) {
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
