import OpenAI from 'openai';
import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks, EmbeddingOptions } from './types';

export class OpenRouterProvider implements LLMProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';
  readonly supportsEmbeddings = false;
  private client: OpenAI | null = null;
  private apiKey = '';

  setApiKey(key: string) {
    this.apiKey = key;
    this.client = key ? new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: key,
      defaultHeaders: { 'HTTP-Referer': 'https://memorwise.local', 'X-Title': 'Memorwise' },
    }) : null;
  }
  getApiKey() { return this.apiKey; }
  private getClient(): OpenAI { if (!this.client) throw new Error('OpenRouter API key not configured'); return this.client; }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      if (!res.ok) return [];
      const data = await res.json() as { data: { id: string; name: string }[] };
      // Return top popular models, sorted
      return (data.data || [])
        .slice(0, 100)
        .map(m => ({ id: m.id, name: m.name || m.id, provider: 'openrouter', supportsStreaming: true }));
    } catch { return []; }
  }

  async generate(options: GenerateOptions): Promise<string> {
    const r = await this.getClient().chat.completions.create({
      model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7,
    });
    return r.choices[0]?.message?.content || '';
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const stream = await this.getClient().chat.completions.create({
        model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7, stream: true,
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
