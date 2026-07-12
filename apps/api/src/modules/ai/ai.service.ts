import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RiskLevel } from '@prisma/client';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Thin client over any OpenAI-compatible API (OpenAI, Azure, Together,
 * Groq, vLLM, Ollama...). Base URL and model are configuration-driven.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  readonly chatModel: string;
  readonly embeddingModel: string;
  readonly embeddingDim: number;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.apiKey = config.get<string>('AI_API_KEY') ?? '';
    this.chatModel = config.get<string>('AI_CHAT_MODEL') ?? 'gpt-4o-mini';
    this.embeddingModel = config.get<string>('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
    this.embeddingDim = Number(config.get('AI_EMBEDDING_DIM') ?? 1536);
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async complete(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean },
  ): Promise<ChatCompletionResult> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
        ...(options?.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Chat completion failed (${res.status}): ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException('AI service request failed');
    }
    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    return {
      content: json.choices[0]?.message?.content ?? '',
      tokensIn: json.usage?.prompt_tokens ?? 0,
      tokensOut: json.usage?.completion_tokens ?? 0,
    };
  }

  /**
   * Streams a chat completion, invoking onDelta for each content chunk.
   * Returns the full accumulated text.
   */
  async streamComplete(
    messages: ChatMessage[],
    onDelta: (delta: string) => void,
    options?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.chatModel,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
        stream: true,
      }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Streaming completion failed (${res.status}): ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException('AI service request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          // Ignore malformed keep-alive lines
        }
      }
    }
    return full;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException('AI service is not configured');
    }
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: this.embeddingModel, input: texts }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Embedding failed (${res.status}): ${text.slice(0, 300)}`);
      throw new ServiceUnavailableException('Embedding request failed');
    }
    const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  // ------------------------------------------------------------
  // Sentiment analysis
  // ------------------------------------------------------------

  private static readonly NEGATIVE_WORDS = [
    'sad', 'depressed', 'anxious', 'worried', 'scared', 'afraid', 'hopeless', 'worthless',
    'tired', 'exhausted', 'angry', 'lonely', 'alone', 'stressed', 'overwhelmed', 'crying',
    'hurt', 'pain', 'terrible', 'awful', 'hate', 'miserable', 'panic', 'fear',
  ];
  private static readonly POSITIVE_WORDS = [
    'happy', 'good', 'great', 'better', 'calm', 'peaceful', 'grateful', 'hopeful',
    'excited', 'proud', 'joy', 'love', 'wonderful', 'amazing', 'relaxed', 'confident',
    'improving', 'progress', 'thankful', 'blessed',
  ];

  /**
   * Returns a sentiment score in [-1, 1]. Uses the LLM when configured,
   * with a lexicon fallback so the platform degrades gracefully.
   */
  async analyzeSentiment(text: string): Promise<number> {
    if (this.isConfigured) {
      try {
        const result = await this.complete(
          [
            {
              role: 'system',
              content:
                'You are a sentiment analysis engine. Respond with JSON only: {"score": <number between -1 and 1>} where -1 is extremely negative and 1 is extremely positive.',
            },
            { role: 'user', content: text.slice(0, 4000) },
          ],
          { temperature: 0, maxTokens: 30, jsonMode: true },
        );
        const parsed = JSON.parse(result.content) as { score?: number };
        if (typeof parsed.score === 'number') {
          return Math.max(-1, Math.min(1, parsed.score));
        }
      } catch (err) {
        this.logger.warn(`LLM sentiment failed, using lexicon fallback: ${(err as Error).message}`);
      }
    }
    return this.lexiconSentiment(text);
  }

  lexiconSentiment(text: string): number {
    const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
    if (words.length === 0) return 0;
    let score = 0;
    for (const word of words) {
      if (AiService.NEGATIVE_WORDS.includes(word)) score -= 1;
      if (AiService.POSITIVE_WORDS.includes(word)) score += 1;
    }
    return Math.max(-1, Math.min(1, score / Math.sqrt(words.length)));
  }

  // ------------------------------------------------------------
  // Crisis / risk detection
  // ------------------------------------------------------------

  private static readonly CRITICAL_PATTERNS = [
    /\b(kill(ing)? myself|end my life|suicide|suicidal|want to die|better off dead|take my own life)\b/i,
    /\b(hurt(ing)? myself|self[- ]?harm|cutting myself|overdose)\b/i,
  ];
  private static readonly HIGH_PATTERNS = [
    /\b(no reason to live|can'?t go on|give up on life|nothing matters anymore)\b/i,
    /\b(hopeless|worthless)\b.*\b(always|every ?day|forever)\b/i,
  ];

  detectRisk(text: string): RiskLevel {
    for (const pattern of AiService.CRITICAL_PATTERNS) {
      if (pattern.test(text)) return RiskLevel.CRITICAL;
    }
    for (const pattern of AiService.HIGH_PATTERNS) {
      if (pattern.test(text)) return RiskLevel.HIGH;
    }
    const sentiment = this.lexiconSentiment(text);
    if (sentiment <= -0.6) return RiskLevel.MODERATE;
    if (sentiment <= -0.3) return RiskLevel.LOW;
    return RiskLevel.NONE;
  }
}
