import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthModule } from '../identity/auth/auth.module.js';
import { CensusModule } from '../census/census.module.js';
import { AssistanceModule } from '../assistance/assistance.module.js';
import { ChatbotController } from './chatbot.controller.js';
import { ChatbotOrchestratorService } from './chatbot-orchestrator.service.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { ChatbotToolRegistry } from './tools/chatbot-tool.registry.js';
import { KnowledgeRetrieverService } from './rag/knowledge-retriever.service.js';
import { ChatbotActionValidatorService } from './safety/chatbot-action-validator.service.js';
import { ChatbotResponseValidatorService } from './safety/chatbot-response-validator.service.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    CensusModule,
    AssistanceModule,
  ],
  controllers: [ChatbotController],
  providers: [
    ChatbotOrchestratorService,
    GeminiProvider,
    ChatbotToolRegistry,
    KnowledgeRetrieverService,
    ChatbotActionValidatorService,
    ChatbotResponseValidatorService,
  ],
  exports: [ChatbotOrchestratorService],
})
export class ChatbotModule {}

