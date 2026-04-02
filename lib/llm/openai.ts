import OpenAI from 'openai';
import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks, EmbeddingOptions } from './types';

export class OpenAIProvider implements LLMProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly supportsEmbeddings = true;
  private client: OpenAI | null = null;
  private apiKey = '';
  private baseUrl = '';

  setApiKey(key: string) { this.apiKey = key; this.rebuildClient(); }
  getApiKey() { return this.apiKey; }
  setBaseUrl(url: string) { this.baseUrl = url; this.rebuildClient(); }
  getBaseUrl() { return this.baseUrl; }
  private rebuildClient() {
    if (!this.apiKey) { this.client = null; return; }
    const opts: { apiKey: string; baseURL?: string } = { apiKey: this.apiKey };
    if (this.baseUrl) opts.baseURL = this.baseUrl;
    this.client = new OpenAI(opts);
  }
  private getClient(): OpenAI { if (!this.client) throw new Error('OpenAI API key not configured'); return this.client; }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try { const m = await this.getClient().models.list(); return m.data.length > 0; } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    return []; // User types model name directly
  }

  async generate(options: GenerateOptions): Promise<string> {
    const r = await this.getClient().chat.completions.create({ model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7 });
    return r.choices[0]?.message?.content || '';
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const stream = await this.getClient().chat.completions.create({ model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7, stream: true });
      let fullText = '';
      for await (const chunk of stream) { const d = chunk.choices[0]?.delta?.content; if (d) { fullText += d; callbacks.onToken(d); } }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }

  async embed(options: EmbeddingOptions): Promise<number[][]> {
    const model = options.model || 'text-embedding-3-small';
    const results: number[][] = [];
    for (let i = 0; i < options.texts.length; i += 100) {
      const r = await this.getClient().embeddings.create({ model, input: options.texts.slice(i, i + 100) });
      for (const item of r.data) results.push(item.embedding);
    }
    return results;
  }
}
