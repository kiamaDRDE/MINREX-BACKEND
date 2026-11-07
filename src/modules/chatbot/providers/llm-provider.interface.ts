export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: string[];
      }
    >;
    required?: string[];
  };
}

export interface LLMToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface LLMGenerateInput {
  messages: LLMMessage[];
  tools?: LLMToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMGenerateOutput {
  text: string;
  toolCalls?: LLMToolCall[];
  finishReason?: string;
}

export interface LLMProvider {
  readonly name: string;
  generate(input: LLMGenerateInput): Promise<LLMGenerateOutput>;
}

