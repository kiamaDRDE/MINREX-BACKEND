import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { ConfigService } from '@nestjs/config';

import { ChatbotOrchestratorService } from './chatbot-orchestrator.service.js';
import type { GeminiProvider } from './providers/gemini.provider.js';
import type {
  KnowledgeRetrieverService,
  RetrievedPassage,
} from './rag/knowledge-retriever.service.js';
import { ChatbotActionValidatorService } from './safety/chatbot-action-validator.service.js';
import { ChatbotResponseValidatorService } from './safety/chatbot-response-validator.service.js';
import type { ChatbotToolRegistry } from './tools/chatbot-tool.registry.js';

describe('ChatbotOrchestratorService', () => {
  const configMock = {
    get: jest.fn(() => undefined),
  } as unknown as ConfigService;

  const geminiMock = {
    generate: jest.fn(),
  } as unknown as GeminiProvider;

  const toolRegistryMock = {
    getToolDefinitions: jest.fn(() => []),
    executeTool: jest.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>(),
  };

  const knowledgeRetrieverMock = {
    retrieveRelevantDocs: jest.fn<(...args: unknown[]) => Promise<RetrievedPassage[]>>(),
    getActiveProtocolDocs: jest.fn<() => Promise<unknown[]>>(),
  };

  let orchestrator: ChatbotOrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    knowledgeRetrieverMock.retrieveRelevantDocs.mockResolvedValue([]);
    knowledgeRetrieverMock.getActiveProtocolDocs.mockResolvedValue([]);

    orchestrator = new ChatbotOrchestratorService(
      configMock,
      geminiMock,
      toolRegistryMock as unknown as ChatbotToolRegistry,
      knowledgeRetrieverMock as unknown as KnowledgeRetrieverService,
      new ChatbotActionValidatorService(),
      new ChatbotResponseValidatorService(),
    );
  });

  it('responds warmly to polite greetings and introduces itself cleanly', async () => {
    const resBonjour = await orchestrator.handleUserMessage({
      userId: 'user-1',
      message: 'Bonjour',
    });

    expect(resBonjour.reply).toContain('Assistant Numérique du MINREX');
    expect(resBonjour.suggestedFollowUps.length).toBeGreaterThan(0);
    expect(knowledgeRetrieverMock.retrieveRelevantDocs).not.toHaveBeenCalled();

    const resWho = await orchestrator.handleUserMessage({
      userId: 'user-1',
      message: 'Qui es-tu ?',
    });
    expect(resWho.reply).toContain('Ministère des Relations Extérieures');

    const resThanks = await orchestrator.handleUserMessage({
      userId: 'user-1',
      message: 'Merci beaucoup !',
    });
    expect(resThanks.reply.toLowerCase()).toContain('plaisir');
  });

  it('serves live DB protocol details with PREFILL_ASSISTANCE action card', async () => {
    knowledgeRetrieverMock.retrieveRelevantDocs.mockResolvedValue([
      {
        score: 14,
        snippet: 'Transfert médical urgent',
        document: {
          id: 'db-protocol-evacuation_sanitaire',
          title: '🏥 Évacuation sanitaire',
          reference: 'Protocole Officiel MINREX · EVACUATION_SANITAIRE',
          updatedAt: '2026-11-19',
          category: 'ASSISTANCE_URGENCE',
          keywords: ['evacuation', 'sanitaire'],
          summary: 'Transfert médical urgent',
          content: '**Étapes officielles :**\n1. **Alerte**',
          officialLink: '/espace/assistance',
        },
        protocolMeta: {
          categoryId: 'cat-evac',
          code: 'EVACUATION_SANITAIRE',
          shortName: 'Évacuation Sanitaire',
          categoryGroup: 'Urgence & Détresse',
          defaultUrgency: 'CRITICAL',
          defaultSlaHours: 6,
          icon: '🏥',
          steps: [],
        },
      },
    ]);

    const res = await orchestrator.handleUserMessage({
      userId: 'user-1',
      message: 'Quelle est la procédure pour une évacuation sanitaire ?',
    });

    expect(res.reply).toContain('Évacuation sanitaire');
    expect(res.actionCards?.[0]?.type).toBe('PREFILL_ASSISTANCE');
    expect(res.actionCards?.[0]?.prefillData).toEqual({
      categoryId: 'cat-evac',
      categoryCode: 'EVACUATION_SANITAIRE',
      urgency: 'CRITICAL',
    });
  });

  it('displays real assistance case reference and urgency without undefined', async () => {
    toolRegistryMock.executeTool.mockResolvedValue({
      hasCases: true,
      total: 1,
      cases: [
        {
          reference: 'AST-ABC12345',
          subject: 'Perte passeport Paris',
          status: 'SUBMITTED',
          urgency: 'HIGH',
        },
      ],
    });

    const res = await orchestrator.handleUserMessage({
      userId: 'user-1',
      message: 'Quels sont mes dossiers d’assistance ?',
    });

    expect(res.reply).toContain('AST-ABC12345');
    expect(res.reply).toContain('HIGH');
    expect(res.reply).not.toContain('undefined');
  });
});
