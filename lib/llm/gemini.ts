import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, LLMModel, GenerateOptions, StreamCallbacks, EmbeddingOptions } from './types';

export class GeminiProvider implements LLMProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly supportsEmbeddings = true;
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey = '';

  setApiKey(key: string) { this.apiKey = key; this.genAI = key ? new GoogleGenerativeAI(key) : null; }
  getApiKey() { return this.apiKey; }
  private getAI() { if (!this.genAI) throw new Error('Gemini API key not configured'); return this.genAI; }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) return false;
    try { const m = this.getAI().getGenerativeModel({ model: 'gemini-2.0-flash' }); const r = await m.generateContent('Hi'); return !!r.response.text(); } catch { return false; }
  }

  async listModels(): Promise<LLMModel[]> {
    return []; // User types model name directly
  }

  private convertMessages(messages: GenerateOptions['messages']) {
    let systemInstruction: string | null = null;
    const contents: { role: string; parts: { text: string }[] }[] = [];
    for (const m of messages) {
      if (m.role === 'system') systemInstruction = m.content;
      else contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
    if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: '' }] });
    return { systemInstruction, contents };
  }

  async generate(options: GenerateOptions): Promise<string> {
    const model = this.getAI().getGenerativeModel({ model: options.model });
    const { systemInstruction, contents } = this.convertMessages(options.messages);
    const r = await model.generateContent({ contents, systemInstruction: systemInstruction || undefined, generationConfig: { temperature: options.temperature ?? 0.7 } });
    return r.response.text();
  }

  async generateStream(options: GenerateOptions, callbacks: StreamCallbacks): Promise<void> {
    try {
      const model = this.getAI().getGenerativeModel({ model: options.model });
      const { systemInstruction, contents } = this.convertMessages(options.messages);
      const r = await model.generateContentStream({ contents, systemInstruction: systemInstruction || undefined, generationConfig: { temperature: options.temperature ?? 0.7 } });
      let fullText = '';
      for await (const chunk of r.stream) { const t = chunk.text(); if (t) { fullText += t; callbacks.onToken(t); } }
      callbacks.onComplete(fullText);
    } catch (err) { callbacks.onError(err instanceof Error ? err : new Error(String(err))); }
  }

  async embed(options: EmbeddingOptions): Promise<number[][]> {
    const model = this.getAI().getGenerativeModel({ model: options.model || 'text-embedding-004' });
    const results: number[][] = [];
    for (let i = 0; i < options.texts.length; i += 100) {
      const batch = options.texts.slice(i, i + 100);
      const r = await model.batchEmbedContents({ requests: batch.map(text => ({ content: { role: 'user', parts: [{ text }] } })) });
      for (const e of r.embeddings) results.push(e.values);
    }
    return results;
  }
}
