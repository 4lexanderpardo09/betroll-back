import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MiniMaxResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    finish_reason: string;
    message: MiniMaxMessage;
    reasoning_content?: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

@Injectable()
export class MiniMaxService {
  private readonly baseUrl = 'https://api.minimax.io/v1';
  private readonly model = 'MiniMax-M2.7';
  private readonly maxTokens = 16000;
  private readonly temperature = 0.7;
  private readonly logger = new Logger(MiniMaxService.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    const key = this.configService.get<string>('MINIMAX_API_KEY');
    if (!key) {
      throw new Error('MINIMAX_API_KEY not configured');
    }
    return key;
  }

  /**
   * Send a chat completion request to MiniMax
   */
  async chatCompletion(
    messages: MiniMaxMessage[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
    },
  ): Promise<{
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    const url = `${this.baseUrl}/text/chatcompletion_v2`;

    const body = {
      model: options?.model || this.model,
      max_tokens: options?.maxTokens || this.maxTokens,
      temperature: options?.temperature ?? this.temperature,
      messages,
    };

    this.logger.debug(`MiniMax API request to ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`MiniMax API error: ${response.status} - ${errorText}`);
      throw new InternalServerErrorException(
        `MiniMax API error: ${response.status} - ${errorText}`,
      );
    }

    const data: MiniMaxResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new InternalServerErrorException('MiniMax returned no choices');
    }

    const choice = data.choices[0];
    
    // Get content from message or reasoning_content (MiniMax puts reasoning in separate field)
    const message = choice.message;
    let content = message?.content || '';
    
    // If content is empty, check reasoning_content
    if (!content && choice.reasoning_content) {
      content = choice.reasoning_content;
    }
    
    return {
      content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  /**
   * Generate a simple completion (single prompt)
   */
  async complete(
    prompt: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
    },
  ): Promise<{
    content: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }> {
    return this.chatCompletion(
      [{ role: 'user', content: prompt }],
      options,
    );
  }
}
