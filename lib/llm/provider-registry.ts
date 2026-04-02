import type { LLMProvider } from './types';
import { OllamaProvider } from './ollama';
import { OpenAIProvider } from './openai';
import { GeminiProvider } from './gemini';
import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';
import { LMStudioProvider } from './lmstudio';
import { GroqProvider } from './groq';
import { MistralProvider } from './mistral';
import { getSetting, setSetting } from '../db/queries';

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

class ProviderRegistry {
  readonly ollama = new OllamaProvider();
  readonly openai = new OpenAIProvider();
  readonly gemini = new GeminiProvider();
  readonly anthropic = new AnthropicProvider();
  readonly openrouter = new OpenRouterProvider();
  readonly lmstudio = new LMStudioProvider();
  readonly groq = new GroqProvider();
  readonly mistral = new MistralProvider();
  private providers = new Map<string, LLMProvider>();
  private loaded = false;

  constructor() {
    this.providers.set('ollama', this.ollama);
    this.providers.set('openai', this.openai);
    this.providers.set('gemini', this.gemini);
    this.providers.set('anthropic', this.anthropic);
    this.providers.set('openrouter', this.openrouter);
    this.providers.set('lmstudio', this.lmstudio);
    this.providers.set('groq', this.groq);
    this.providers.set('mistral', this.mistral);
  }

  private ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const openaiKey = getSetting('openai_api_key');
      if (openaiKey) this.openai.setApiKey(openaiKey);
      const geminiKey = getSetting('gemini_api_key');
      if (geminiKey) this.gemini.setApiKey(geminiKey);
      const anthropicKey = getSetting('anthropic_api_key');
      if (anthropicKey) this.anthropic.setApiKey(anthropicKey);
      const openrouterKey = getSetting('openrouter_api_key');
      if (openrouterKey) this.openrouter.setApiKey(openrouterKey);
      const ollamaUrl = getSetting('ollama_base_url');
      if (ollamaUrl) this.ollama.setBaseUrl(ollamaUrl);
      const lmstudioUrl = getSetting('lmstudio_base_url');
      if (lmstudioUrl) this.lmstudio.setBaseUrl(lmstudioUrl);
      const groqKey = getSetting('groq_api_key');
      if (groqKey) this.groq.setApiKey(groqKey);
      const mistralKey = getSetting('mistral_api_key');
      if (mistralKey) this.mistral.setApiKey(mistralKey);
    } catch { /* DB not ready yet */ }
  }

  getProvider(id: string): LLMProvider | undefined { this.ensureLoaded(); return this.providers.get(id); }

  getActiveProvider(): LLMProvider {
    this.ensureLoaded();
    const id = getSetting('active_provider') || 'ollama';
    return this.providers.get(id) || this.ollama;
  }

  getEmbeddingProvider(): LLMProvider {
    this.ensureLoaded();
    // Check for explicit embedding provider setting
    const explicitId = getSetting('embedding_provider');
    if (explicitId && explicitId !== 'auto') {
      const explicit = this.providers.get(explicitId);
      if (explicit && explicit.supportsEmbeddings && explicit.embed) return explicit;
    }
    // Fallback chain: active provider > configured API providers > Ollama
    const active = this.getActiveProvider();
    if (active.supportsEmbeddings && active.embed) return active;
    // Prefer providers with API keys (known to be configured)
    if (this.openai.getApiKey() && this.openai.supportsEmbeddings) return this.openai;
    if (this.gemini.getApiKey() && this.gemini.supportsEmbeddings) return this.gemini;
    if (this.mistral.getApiKey() && this.mistral.supportsEmbeddings) return this.mistral;
    // Local providers as last resort
    return this.ollama;
  }

  getActiveChatModel(): string { return getSetting('active_chat_model') || 'llama3.2'; }
  getActiveEmbeddingModel(): string { return getSetting('active_embedding_model') || 'nomic-embed-text'; }
  getEmbeddingProviderId(): string { return getSetting('embedding_provider') || 'auto'; }
  getTranscriptionProvider(): string { return getSetting('transcription_provider') || 'openai'; }
  getLocalWhisperModel(): string { return getSetting('local_whisper_model') || ''; }
  getTTSProvider(): string { return getSetting('tts_provider') || 'openai'; }
  getTTSVoice(): string { return getSetting('tts_voice') || 'nova'; }
  getKokoroUrl(): string { return getSetting('kokoro_url') || 'http://localhost:8787'; }
  getKokoroVoice(): string { return getSetting('kokoro_voice') || 'af_heart'; }
  getPodcastSpeakers(): number { const v = getSetting('podcast_speakers'); return v ? parseInt(v) : 2; }
  setPodcastSpeakers(n: number) { setSetting('podcast_speakers', String(Math.min(4, Math.max(1, n)))); }

  setActiveProvider(id: string) { setSetting('active_provider', id); }
  setActiveChatModel(m: string) { setSetting('active_chat_model', m); }
  setActiveEmbeddingModel(m: string) { setSetting('active_embedding_model', m); }
  setEmbeddingProvider(id: string) { setSetting('embedding_provider', id); }
  setTranscriptionProvider(id: string) { setSetting('transcription_provider', id); }
  setLocalWhisperModel(id: string) { setSetting('local_whisper_model', id); }
  setTTSProvider(id: string) { setSetting('tts_provider', id); }
  setTTSVoice(voice: string) { setSetting('tts_voice', voice); }
  setKokoroUrl(url: string) { setSetting('kokoro_url', url); }
  setKokoroVoice(voice: string) { setSetting('kokoro_voice', voice); }

  setProviderConfig(providerId: string, config: { apiKey?: string; baseUrl?: string }) {
    switch (providerId) {
      case 'openai': if (config.apiKey !== undefined) { this.openai.setApiKey(config.apiKey); setSetting('openai_api_key', config.apiKey); } break;
      case 'gemini': if (config.apiKey !== undefined) { this.gemini.setApiKey(config.apiKey); setSetting('gemini_api_key', config.apiKey); } break;
      case 'anthropic': if (config.apiKey !== undefined) { this.anthropic.setApiKey(config.apiKey); setSetting('anthropic_api_key', config.apiKey); } break;
      case 'openrouter': if (config.apiKey !== undefined) { this.openrouter.setApiKey(config.apiKey); setSetting('openrouter_api_key', config.apiKey); } break;
      case 'ollama': if (config.baseUrl !== undefined) { this.ollama.setBaseUrl(config.baseUrl); setSetting('ollama_base_url', config.baseUrl); } break;
      case 'lmstudio': if (config.baseUrl !== undefined) { this.lmstudio.setBaseUrl(config.baseUrl); setSetting('lmstudio_base_url', config.baseUrl); } break;
      case 'groq': if (config.apiKey !== undefined) { this.groq.setApiKey(config.apiKey); setSetting('groq_api_key', config.apiKey); } break;
      case 'mistral': if (config.apiKey !== undefined) { this.mistral.setApiKey(config.apiKey); setSetting('mistral_api_key', config.apiKey); } break;
    }
  }

  getProviderConfig(providerId: string): { apiKey?: string; baseUrl?: string; hasApiKey?: boolean } {
    this.ensureLoaded();
    switch (providerId) {
      case 'openai': return { apiKey: maskKey(this.openai.getApiKey()), hasApiKey: !!this.openai.getApiKey() };
      case 'gemini': return { apiKey: maskKey(this.gemini.getApiKey()), hasApiKey: !!this.gemini.getApiKey() };
      case 'anthropic': return { apiKey: maskKey(this.anthropic.getApiKey()), hasApiKey: !!this.anthropic.getApiKey() };
      case 'openrouter': return { apiKey: maskKey(this.openrouter.getApiKey()), hasApiKey: !!this.openrouter.getApiKey() };
      case 'groq': return { apiKey: maskKey(this.groq.getApiKey()), hasApiKey: !!this.groq.getApiKey() };
      case 'mistral': return { apiKey: maskKey(this.mistral.getApiKey()), hasApiKey: !!this.mistral.getApiKey() };
      case 'ollama': return { baseUrl: this.ollama.getBaseUrl() };
      case 'lmstudio': return { baseUrl: this.lmstudio.getBaseUrl() };
      default: return {};
    }
  }

  getAllProviders(): LLMProvider[] { this.ensureLoaded(); return Array.from(this.providers.values()); }
}

// Survive Next.js HMR — singleton on globalThis
const globalForRegistry = globalThis as unknown as { __memorwise_registry?: ProviderRegistry };
if (!globalForRegistry.__memorwise_registry) {
  globalForRegistry.__memorwise_registry = new ProviderRegistry();
}
export const registry = globalForRegistry.__memorwise_registry;
