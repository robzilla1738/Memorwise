import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks, EmbeddingOptions } from './types';

const API_URL = 'https://api.mistral.ai/v1';

export class MistralProvider implements LLMProvider {
  readonly id = 'mistral';
  readonly name = 'Mistral';
  readonly supportsEmbeddings = true;
  private apiKey = '';

  setApiKey(key: string) { this.apiKey = key; }
  getApiKey() { return this.apiKey; }

  private headers() {
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.apiKey}` };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(`${API_URL}/models`, { headers: this.headers(), signal: AbortSignal.timeout(5000) });
      return res.ok;
    } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    return []; // User types model name directly
  }

  async generate(options: GenerateOptions): Promise<string> {
    const res = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Mistral error: ${res.status} ${await res.text()}`);
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content || '';
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const res = await fetch(`${API_URL}/chat/completions`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: options.model, messages: options.messages, temperature: options.temperature ?? 0.7, stream: true,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        }),
      });
      if (!res.ok) throw new Error(`Mistral error: ${res.status} ${await res.text()}`);

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
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            const d = event.choices?.[0]?.delta?.content;
            if (d) { fullText += d; callbacks.onToken(d); }
          } catch { /* skip */ }
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }

  async embed(options: EmbeddingOptions): Promise<number[][]> {
    const model = options.model || 'mistral-embed';
    const results: number[][] = [];
    for (let i = 0; i < options.texts.length; i += 32) {
      const batch = options.texts.slice(i, i + 32);
      const res = await fetch(`${API_URL}/embeddings`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ model, input: batch }),
      });
      if (!res.ok) throw new Error(`Mistral embed error: ${res.status} ${await res.text()}`);
      const data = await res.json() as { data: { embedding: number[] }[] };
      for (const item of data.data) results.push(item.embedding);
    }
    return results;
  }
}
