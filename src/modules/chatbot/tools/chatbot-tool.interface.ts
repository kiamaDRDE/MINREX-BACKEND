import { LLMToolDefinition } from '../providers/llm-provider.interface.js';

export interface ChatbotToolContext {
  userId: string;
  email?: string;
  conversationId?: string;
}

export interface ChatbotTool {
  readonly definition: LLMToolDefinition;
  execute(
    args: Record<string, unknown>,
    context: ChatbotToolContext,
  ): Promise<Record<string, unknown>>;
}
