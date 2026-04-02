import OpenAI from 'openai';
import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks } from './types';

export class GroqProvider implements LLMProvider {
  readonly id = 'groq';
  readonly name = 'Groq';
  readonly supportsEmbeddings = false;
  private client: OpenAI | null = null;
  private apiKey = '';

  setApiKey(key: string) {
    this.apiKey = key;
    this.client = key ? new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: key }) : null;
  }
  getApiKey() { return this.apiKey; }
  private getClient(): OpenAI { if (!this.client) throw new Error('Groq API key not configured'); return this.client; }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try { const m = await this.getClient().models.list(); return m.data.length > 0; } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    return []; // User types model name directly
  }

  async generate(options: GenerateOptions): Promise<string> {
    const r = await this.getClient().chat.completions.create({
      model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    });
    return r.choices[0]?.message?.content || '';
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const stream = await this.getClient().chat.completions.create({
        model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7, stream: true,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      });
      let fullText = '';
      for await (const chunk of stream) {
        const d = chunk.choices[0]?.delta?.content;
        if (d) { fullText += d; callbacks.onToken(d); }
      }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }
}
