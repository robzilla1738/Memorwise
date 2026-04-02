import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks } from './types';

const API_URL = 'https://api.anthropic.com/v1/messages';

export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly supportsEmbeddings = false;
  private apiKey = '';

  setApiKey(key: string) { this.apiKey = key; }
  getApiKey() { return this.apiKey; }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2025-04-14' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      return res.ok || res.status === 400; // 400 = valid key but bad request is fine
    } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    return []; // User types model name directly
  }

  async generate(options: GenerateOptions): Promise<string> {
    const { system, messages } = this.convertMessages(options.messages);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2025-04-14' },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        ...(system ? { system } : {}),
        messages,
        temperature: options.temperature ?? 0.7,
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);
    const data = await res.json() as { content: { type: string; text: string }[] };
    return data.content.filter(c => c.type === 'text').map(c => c.text).join('');
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const { system, messages } = this.convertMessages(options.messages);
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': this.apiKey, 'anthropic-version': '2025-04-14' },
        body: JSON.stringify({
          model: options.model,
          max_tokens: options.maxTokens || 4096,
          ...(system ? { system } : {}),
          messages,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
      });
      if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${await res.text()}`);

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
            if (event.type === 'content_block_delta' && event.delta?.text) {
              fullText += event.delta.text;
              callbacks.onToken(event.delta.text);
            }
          } catch { /* skip */ }
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }

  private convertMessages(msgs: GenerateOptions['messages']): { system: string | null; messages: { role: string; content: string }[] } {
    let system: string | null = null;
    const messages: { role: string; content: string }[] = [];
    for (const m of msgs) {
      if (m.role === 'system') system = m.content;
      else messages.push({ role: m.role, content: m.content });
    }
    return { system, messages };
  }
}
