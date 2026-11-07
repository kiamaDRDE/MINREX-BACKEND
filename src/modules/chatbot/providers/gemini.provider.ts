import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LLMGenerateInput,
  LLMGenerateOutput,
  LLMProvider,
  LLMToolCall,
} from './llm-provider.interface.js';

@Injectable()
export class GeminiProvider implements LLMProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  readonly name = 'gemini';

  constructor(private readonly configService: ConfigService) {}

  async generate(input: LLMGenerateInput): Promise<LLMGenerateOutput> {
    const apiKey =
      this.configService.get<string>('AI_API_KEY') ||
      this.configService.get<string>('GEMINI_API_KEY');
    const model =
      this.configService.get<string>('AI_MODEL') || 'gemini-2.0-flash';

    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Falling back to deterministic knowledge retriever.',
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // 1. Extraire le prompt système et convertir l'historique
    const systemMessage = input.messages.find((m) => m.role === 'system');
    const nonSystemMessages = input.messages.filter((m) => m.role !== 'system');

    const contents = nonSystemMessages.map((msg) => {
      const parts: any[] = [];

      if (msg.role === 'tool') {
        parts.push({
          functionResponse: {
            name: msg.name || 'tool_response',
            response: {
              content: msg.content,
            },
          },
        });
      } else if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.args,
            },
          });
        }
      } else {
        parts.push({ text: msg.content || ' ' });
      }

      return {
        role:
          msg.role === 'assistant'
            ? 'model'
            : msg.role === 'tool'
              ? 'function'
              : 'user',
        parts,
      };
    });

    // 2. Préparer les outils (Function Declarations)
    const tools =
      input.tools && input.tools.length > 0
        ? [
            {
              functionDeclarations: input.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters,
              })),
            },
          ]
        : undefined;

    const requestBody: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: input.temperature ?? 0.2,
        maxOutputTokens: input.maxTokens ?? 1024,
      },
    };

    if (systemMessage) {
      requestBody.systemInstruction = {
        parts: [{ text: systemMessage.content }],
      };
    }

    if (tools) {
      requestBody.tools = tools;
    }

    const timeoutMs =
      this.configService.get<number>('AI_REQUEST_TIMEOUT_MS') || 10000;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.warn(
        `Gemini API returned HTTP ${response.status}: ${errorText}`,
      );
      throw new Error(
        `Gemini API error: HTTP ${response.status} (${response.statusText})`,
      );
    }

    const data: any = await response.json();
    const candidate = data?.candidates?.[0];

    if (!candidate) {
      throw new Error('Gemini API returned an empty response.');
    }

    let text = '';
    const toolCalls: LLMToolCall[] = [];

    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.text) {
        text += part.text;
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: part.functionCall.name,
          args: part.functionCall.args || {},
        });
      }
    }

    return {
      text: text.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: candidate.finishReason,
    };
  }
}
