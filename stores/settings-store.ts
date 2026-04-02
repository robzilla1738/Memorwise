import { create } from 'zustand';
import type { LLMModel } from '@/lib/types';

interface SettingsState {
  isOpen: boolean;
  activeProvider: string;
  activeChatModel: string;
  activeEmbeddingModel: string;
  embeddingProvider: string;
  transcriptionProvider: string;
  localWhisperModel: string;
  ttsProvider: string;
  ttsVoice: string;
  kokoroUrl: string;
  kokoroVoice: string;
  podcastSpeakers: number;
  availableModels: LLMModel[];
  providers: { id: string; name: string; available: boolean; apiKey?: string; hasApiKey?: boolean; baseUrl?: string }[];

  openSettings: () => void;
  closeSettings: () => void;
  loadSettings: () => Promise<void>;
  loadProviders: () => Promise<void>;
  loadModels: (providerId: string) => Promise<void>;
  setProvider: (id: string) => Promise<void>;
  setChatModel: (m: string) => Promise<void>;
  setEmbeddingModel: (m: string) => Promise<void>;
  setEmbeddingProvider: (id: string) => Promise<void>;
  setTranscriptionProvider: (id: string) => Promise<void>;
  setLocalWhisperModel: (id: string) => Promise<void>;
  setTTSProvider: (id: string) => Promise<void>;
  setKokoroUrl: (url: string) => Promise<void>;
  setKokoroVoice: (voice: string) => Promise<void>;
  setPodcastSpeakers: (n: number) => Promise<void>;
  setTTSVoice: (voice: string) => Promise<void>;
  configureProvider: (id: string, config: { apiKey?: string; baseUrl?: string }) => Promise<void>;
  testConnection: (id: string) => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  activeProvider: 'ollama',
  activeChatModel: 'llama3.2',
  activeEmbeddingModel: 'nomic-embed-text',
  embeddingProvider: 'auto',
  transcriptionProvider: 'openai',
  localWhisperModel: '',
  ttsProvider: 'openai',
  ttsVoice: 'nova',
  kokoroUrl: 'http://localhost:8787',
  kokoroVoice: 'af_heart',
  podcastSpeakers: 2,
  availableModels: [],
  providers: [],

  openSettings: () => set({ isOpen: true }),
  closeSettings: () => set({ isOpen: false }),

  loadSettings: async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      set({ activeProvider: data.activeProvider, activeChatModel: data.activeChatModel, activeEmbeddingModel: data.activeEmbeddingModel, embeddingProvider: data.embeddingProvider || 'auto', transcriptionProvider: data.transcriptionProvider || 'openai', localWhisperModel: data.localWhisperModel || '', ttsProvider: data.ttsProvider || 'openai', ttsVoice: data.ttsVoice || 'nova', kokoroUrl: data.kokoroUrl || 'http://localhost:8787', kokoroVoice: data.kokoroVoice || 'af_heart', podcastSpeakers: data.podcastSpeakers || 2 });
    } catch {}
  },

  loadProviders: async () => {
    const res = await fetch('/api/providers');
    if (!res.ok) return;
    set({ providers: await res.json() });
  },

  loadModels: async (providerId: string) => {
    const res = await fetch('/api/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId, action: 'models' }) });
    if (!res.ok) return;
    set({ availableModels: await res.json() });
  },

  setProvider: async (id: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeProvider: id }) });
    set({ activeProvider: id });
  },

  setChatModel: async (m: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeChatModel: m }) });
    set({ activeChatModel: m });
  },

  setEmbeddingModel: async (m: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activeEmbeddingModel: m }) });
    set({ activeEmbeddingModel: m });
  },

  setEmbeddingProvider: async (id: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeddingProvider: id }) });
    set({ embeddingProvider: id });
  },

  setTranscriptionProvider: async (id: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcriptionProvider: id }) });
    set({ transcriptionProvider: id });
  },

  setLocalWhisperModel: async (id: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localWhisperModel: id }) });
    set({ localWhisperModel: id });
  },

  setTTSProvider: async (id: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ttsProvider: id }) });
    set({ ttsProvider: id });
  },

  setTTSVoice: async (voice: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ttsVoice: voice }) });
    set({ ttsVoice: voice });
  },

  setKokoroUrl: async (url: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kokoroUrl: url }) });
    set({ kokoroUrl: url });
  },

  setKokoroVoice: async (voice: string) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kokoroVoice: voice }) });
    set({ kokoroVoice: voice });
  },

  setPodcastSpeakers: async (n: number) => {
    await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ podcastSpeakers: n }) });
    set({ podcastSpeakers: n });
  },

  configureProvider: async (id: string, config) => {
    await fetch('/api/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: id, action: 'configure', ...config }) });
  },

  testConnection: async (id: string) => {
    const res = await fetch('/api/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: id, action: 'test' }) });
    const data = await res.json();
    return data.available;
  },
}));
