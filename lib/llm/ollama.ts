import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks, EmbeddingOptions } from './types';

const DEFAULT_URL = 'http://localhost:11434';

export class OllamaProvider implements LLMProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama';
  readonly supportsEmbeddings = true;
  private baseUrl: string;

  constructor(baseUrl?: string) { this.baseUrl = baseUrl || DEFAULT_URL; }
  setBaseUrl(url: string) { this.baseUrl = url; }
  getBaseUrl() { return this.baseUrl; }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json() as { models: { name: string; size?: number; details?: { parameter_size?: string; family?: string } }[] };
      return (data.models || []).map(m => {
        const sizeGB = m.size ? `${(m.size / 1e9).toFixed(1)}GB` : '';
        const params = m.details?.parameter_size || '';
        const label = [m.name, params, sizeGB].filter(Boolean).join(' — ');
        return { id: m.name, name: label, provider: 'ollama', supportsStreaming: true };
      });
    } catch { return []; }
  }

  async pullModel(modelName: string): Promise<ReadableStream> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });
    if (!res.ok) throw new Error(`Ollama pull error: ${res.status} ${await res.text()}`);
    return res.body!;
  }

  async generate(options: GenerateOptions): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model, messages: options.messages, stream: false, options: { temperature: options.temperature ?? 0.7 } }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json() as { message: { content: string } };
    return data.message.content;
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: options.model, messages: options.messages, stream: true, options: { temperature: options.temperature ?? 0.7 } }),
      });
      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '', buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line) as { message?: { content?: string } };
            if (json.message?.content) { fullText += json.message.content; callbacks.onToken(json.message.content); }
          } catch { /* skip */ }
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }

  async embed(options: EmbeddingOptions): Promise<number[][]> {
    const model = options.model || 'nomic-embed-text';
    const results: number[][] = [];
    for (let i = 0; i < options.texts.length; i += 32) {
      const batch = options.texts.slice(i, i + 32);
      const res = await fetch(`${this.baseUrl}/api/embed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: batch }),
      });
      if (!res.ok) throw new Error(`Ollama embed error: ${res.status} ${await res.text()}`);
      const data = await res.json() as { embeddings: number[][] };
      results.push(...data.embeddings);
    }
    return results;
  }
}
