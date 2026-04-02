import OpenAI from 'openai';
import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks, EmbeddingOptions } from './types';

export class LMStudioProvider implements LLMProvider {
  readonly id = 'lmstudio';
  readonly name = 'LM Studio';
  readonly supportsEmbeddings = true;
  private baseUrl: string;
  private client: OpenAI;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || 'http://localhost:1234/v1';
    this.client = new OpenAI({ baseURL: this.baseUrl, apiKey: 'lm-studio' });
  }
  setBaseUrl(url: string) { this.baseUrl = url; this.client = new OpenAI({ baseURL: url, apiKey: 'lm-studio' }); }
  getBaseUrl() { return this.baseUrl; }

  async isAvailable(): Promise<boolean> { try { const m = await this.client.models.list(); return m.data.length > 0; } catch { return false; } }
  async listModels(): Promise<LLMModel[]> { try { const r = await this.client.models.list(); return r.data.map(m => ({ id: m.id, name: m.id, provider: 'lmstudio', supportsStreaming: true })); } catch { return []; } }

  async generate(options: GenerateOptions): Promise<string> {
    const r = await this.client.chat.completions.create({ model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7 });
    return r.choices[0]?.message?.content || '';
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const stream = await this.client.chat.completions.create({ model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7, stream: true });
      let fullText = '';
      for await (const chunk of stream) { const d = chunk.choices[0]?.delta?.content; if (d) { fullText += d; callbacks.onToken(d); } }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }

  async embed(options: EmbeddingOptions): Promise<number[][]> {
    // Use fetch directly instead of OpenAI SDK — the SDK sends encoding_format: "base64"
    // which LM Studio doesn't support, returning zero vectors silently.
    const model = options.model || 'text-embedding-nomic-embed-text-v1.5';
    const results: number[][] = [];
    for (let i = 0; i < options.texts.length; i += 100) {
      const batch = options.texts.slice(i, i + 100);
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: batch }),
      });
      if (!res.ok) throw new Error(`LM Studio embed error: ${res.status} ${await res.text()}`);
      const data = await res.json() as { data: { embedding: number[] }[] };
      for (const item of data.data) results.push(item.embedding);
    }
    return results;
  }
}
