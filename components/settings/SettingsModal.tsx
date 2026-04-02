'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Eye, EyeOff, CheckCircle2, XCircle, Loader2, MessageSquare, Database, Mic, Headphones, ChevronDown, RefreshCw, Server } from 'lucide-react';
import { useSettingsStore } from '@/stores/settings-store';

const PROVIDER_META: Record<string, {
  name: string; description: string; needsKey: boolean; needsUrl: boolean;
  defaultUrl?: string; tips: string; placeholder?: string;
  supportsEmbeddings: boolean; supportsTTS: boolean; supportsTranscription: boolean;
}> = {
  ollama: {
    name: 'Ollama', description: 'Run models locally', needsKey: false, needsUrl: true,
    defaultUrl: 'http://localhost:11434',
    tips: 'Install from ollama.com. Run "ollama serve" then pull any model you want.',
    supportsEmbeddings: true, supportsTTS: false, supportsTranscription: false,
  },
  openai: {
    name: 'OpenAI', description: 'API access', needsKey: true, needsUrl: false,
    placeholder: 'sk-...',
    tips: 'Get your key from platform.openai.com/api-keys. Type the exact model name below.',
    supportsEmbeddings: true, supportsTTS: true, supportsTranscription: true,
  },
  anthropic: {
    name: 'Anthropic', description: 'API access', needsKey: true, needsUrl: false,
    placeholder: 'sk-ant-...',
    tips: 'Get your key from console.anthropic.com. Type the exact model name below.',
    supportsEmbeddings: false, supportsTTS: false, supportsTranscription: false,
  },
  gemini: {
    name: 'Gemini', description: 'API access', needsKey: true, needsUrl: false,
    placeholder: 'AI...',
    tips: 'Get your key from aistudio.google.com/apikey. Type the exact model name below.',
    supportsEmbeddings: true, supportsTTS: false, supportsTranscription: false,
  },
  openrouter: {
    name: 'OpenRouter', description: 'Any model, one key', needsKey: true, needsUrl: false,
    placeholder: 'sk-or-...',
    tips: 'Get your key from openrouter.ai/keys. Use any model from any provider.',
    supportsEmbeddings: false, supportsTTS: false, supportsTranscription: false,
  },
  groq: {
    name: 'Groq', description: 'Ultra-fast inference', needsKey: true, needsUrl: false,
    placeholder: 'gsk_...',
    tips: 'Get your key from console.groq.com. Known for extremely fast inference speeds.',
    supportsEmbeddings: false, supportsTTS: false, supportsTranscription: false,
  },
  mistral: {
    name: 'Mistral', description: 'API access', needsKey: true, needsUrl: false,
    placeholder: '',
    tips: 'Get your key from console.mistral.ai. Supports embeddings via mistral-embed model.',
    supportsEmbeddings: true, supportsTTS: false, supportsTranscription: false,
  },
  lmstudio: {
    name: 'LM Studio', description: 'Run models locally', needsKey: false, needsUrl: true,
    defaultUrl: 'http://localhost:1234/v1',
    tips: 'Load a model in LM Studio, then start the local server.',
    supportsEmbeddings: true, supportsTTS: false, supportsTranscription: false,
  },
};

type Tab = 'providers' | 'chat' | 'embeddings' | 'transcription' | 'audio';

const EMBEDDING_PROVIDERS = [
  { id: 'auto', name: 'Auto (use chat provider)' },
  { id: 'ollama', name: 'Ollama' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'mistral', name: 'Mistral' },
  { id: 'lmstudio', name: 'LM Studio' },
];

const TTS_VOICES = [
  { id: 'nova', name: 'Nova', desc: 'Warm, conversational' },
  { id: 'alloy', name: 'Alloy', desc: 'Neutral, balanced' },
  { id: 'echo', name: 'Echo', desc: 'Smooth, mellow' },
  { id: 'fable', name: 'Fable', desc: 'Expressive, British' },
  { id: 'onyx', name: 'Onyx', desc: 'Deep, authoritative' },
  { id: 'shimmer', name: 'Shimmer', desc: 'Clear, upbeat' },
];

export function SettingsModal() {
  const {
    isOpen, closeSettings, activeProvider, activeChatModel, activeEmbeddingModel,
    embeddingProvider, transcriptionProvider, localWhisperModel,
    ttsProvider, ttsVoice, kokoroUrl, kokoroVoice, podcastSpeakers,
    providers, loadProviders,
    setProvider, setChatModel, setEmbeddingModel, setEmbeddingProvider, setTranscriptionProvider, setLocalWhisperModel,
    setTTSProvider, setTTSVoice, setKokoroUrl, setKokoroVoice, setPodcastSpeakers,
    configureProvider, testConnection,
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<Tab>('providers');
  const [selectedId, setSelectedId] = useState(activeProvider);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [chatModelInput, setChatModelInput] = useState('');
  const [embedModelInput, setEmbedModelInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [pullModelName, setPullModelName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState('');
  const [whisperModels, setWhisperModels] = useState<{ id: string; name: string; description: string; accuracy: number; speed: number; size: string; language: string; downloaded: boolean }[]>([]);
  const [downloadingWhisper, setDownloadingWhisper] = useState<string | null>(null);
  const [whisperDownloadStatus, setWhisperDownloadStatus] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProviders();
      setSelectedId(activeProvider);
      setTestResult(null);
      setSaved(false);
      setChatModelInput(activeChatModel);
      setEmbedModelInput(activeEmbeddingModel);
    }
  }, [isOpen, loadProviders, activeProvider, activeChatModel, activeEmbeddingModel]);

  // Providers that can list their models (local servers)
  const canListModels = ['ollama', 'lmstudio'];

  const fetchModels = async (providerId: string) => {
    if (!canListModels.includes(providerId)) { setFetchedModels([]); return; }
    setLoadingModels(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId, action: 'models' }),
      });
      if (res.ok) {
        const models = await res.json();
        setFetchedModels(Array.isArray(models) ? models : []);
      } else {
        setFetchedModels([]);
      }
    } catch { setFetchedModels([]); }
    setLoadingModels(false);
  };

  const pullOllamaModel = async (name: string) => {
    if (!name.trim()) return;
    setPulling(true);
    setPullProgress('Starting download...');
    try {
      const res = await fetch('/api/providers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'ollama', action: 'pull', modelName: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPullProgress(`Error: ${data.error || 'Pull failed'}`);
        setPulling(false);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.status) {
              const pct = event.completed && event.total ? ` (${Math.round(event.completed / event.total * 100)}%)` : '';
              setPullProgress(`${event.status}${pct}`);
            }
          } catch { /* skip */ }
        }
      }
      setPullProgress('Download complete!');
      setPullModelName('');
      // Refresh model list
      await fetchModels(activeProvider);
      setTimeout(() => setPullProgress(''), 3000);
    } catch (err) {
      setPullProgress(`Error: ${err instanceof Error ? err.message : 'Pull failed'}`);
    }
    setPulling(false);
  };

  const fetchWhisperModels = async () => {
    try {
      const res = await fetch('/api/whisper');
      if (res.ok) setWhisperModels(await res.json());
    } catch { /* ignore */ }
  };

  const downloadWhisperModel = async (modelId: string) => {
    setDownloadingWhisper(modelId);
    setWhisperDownloadStatus('Starting download...');
    try {
      const res = await fetch('/api/whisper', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', modelId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setWhisperDownloadStatus(`Error: ${data.error || 'Download failed'}`);
        setDownloadingWhisper(null);
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.status === 'complete') {
              setWhisperDownloadStatus('Download complete!');
              await fetchWhisperModels();
              setLocalWhisperModel(modelId);
              setTimeout(() => setWhisperDownloadStatus(''), 3000);
            } else if (event.status === 'error') {
              setWhisperDownloadStatus(`Error: ${event.error}`);
            } else if (event.status) {
              setWhisperDownloadStatus(event.status);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      setWhisperDownloadStatus(`Error: ${err instanceof Error ? err.message : 'Download failed'}`);
    }
    setDownloadingWhisper(null);
  };

  // Fetch whisper models when transcription tab is open and local is selected
  useEffect(() => {
    if (isOpen && activeTab === 'transcription' && transcriptionProvider === 'local') {
      fetchWhisperModels();
    }
  }, [isOpen, activeTab, transcriptionProvider]);

  // Suggested models for API providers
  const SUGGESTED_MODELS: Record<string, { chat: string[]; embed: string[] }> = {
    openai: { chat: ['gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'o3', 'o4-mini'], embed: ['text-embedding-3-small', 'text-embedding-3-large'] },
    anthropic: { chat: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'], embed: [] },
    gemini: { chat: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'], embed: ['text-embedding-004'] },
    groq: { chat: ['llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'], embed: [] },
    mistral: { chat: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'], embed: ['mistral-embed'] },
    openrouter: { chat: ['openai/gpt-5.4', 'anthropic/claude-sonnet-4-6', 'google/gemini-2.5-flash', 'deepseek/deepseek-r1'], embed: [] },
  };

  // Popular Ollama models for download suggestions
  const OLLAMA_POPULAR = [
    { name: 'llama3.1', desc: '8B — Meta, versatile' },
    { name: 'deepseek-r1', desc: '7B — Reasoning model' },
    { name: 'gemma3', desc: '12B — Google, efficient' },
    { name: 'qwen3', desc: '8B — Multilingual' },
    { name: 'nomic-embed-text', desc: 'Embedding model' },
  ];

  // Auto-fetch models when switching to Chat tab
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      fetchModels(activeProvider);
    }
  }, [isOpen, activeTab, activeProvider]);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSettings(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, closeSettings]);

  useEffect(() => {
    if (isOpen && selectedId) {
      const prov = providers.find(p => p.id === selectedId);
      setUrlInput(prov?.baseUrl || PROVIDER_META[selectedId]?.defaultUrl || '');
      setApiKeyInput('');
      setShowKey(false);
      setTestResult(null);
      setSaved(false);
    }
  }, [isOpen, selectedId, providers]);

  const handleSelectProvider = async (id: string) => {
    setSelectedId(id);
    await setProvider(id);
  };

  const handleSave = async () => {
    const meta = PROVIDER_META[selectedId];
    const config: { apiKey?: string; baseUrl?: string } = {};
    if (meta?.needsKey && apiKeyInput) config.apiKey = apiKeyInput;
    if (meta?.needsUrl && urlInput) config.baseUrl = urlInput;
    if (Object.keys(config).length === 0) return;
    await configureProvider(selectedId, config);
    await loadProviders();
    setApiKeyInput('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testConnection(selectedId);
    setTestResult(result);
    setTesting(false);
    if (result) { await loadProviders(); }
  };

  const saveChatModel = () => {
    if (chatModelInput.trim() && chatModelInput.trim() !== activeChatModel) {
      setChatModel(chatModelInput.trim());
    }
  };

  const saveEmbedModel = () => {
    if (embedModelInput.trim() && embedModelInput.trim() !== activeEmbeddingModel) {
      setEmbeddingModel(embedModelInput.trim());
    }
  };

  const meta = PROVIDER_META[selectedId];
  const prov = providers.find(p => p.id === selectedId);
  const hasOpenAIKey = providers.find(p => p.id === 'openai')?.hasApiKey;

  const chatPlaceholders: Record<string, string> = {
    ollama: 'e.g. llama3.1', openai: 'e.g. gpt-5.4',
    anthropic: 'e.g. claude-sonnet-4-6', gemini: 'e.g. gemini-2.5-flash',
    openrouter: 'e.g. openai/gpt-5.4', lmstudio: 'Your loaded model name',
    groq: 'e.g. llama-3.3-70b-versatile', mistral: 'e.g. mistral-large-latest',
  };
  const embedPlaceholders: Record<string, string> = {
    ollama: 'e.g. nomic-embed-text', openai: 'e.g. text-embedding-3-small',
    gemini: 'e.g. text-embedding-004', lmstudio: 'e.g. text-embedding-nomic',
    mistral: 'e.g. mistral-embed', auto: 'e.g. nomic-embed-text',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closeSettings} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="w-[700px] h-[540px] bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
                <h2 className="text-sm font-medium text-foreground">Settings</h2>
                <button onClick={closeSettings} className="p-1.5 rounded-md hover:bg-elevated text-foreground-secondary hover:text-foreground"><X size={16} /></button>
              </div>

              <div className="flex-1 flex overflow-hidden">
                {/* Left sidebar */}
                <div className="w-[160px] min-w-[160px] border-r border-border py-2 px-2 space-y-0.5 shrink-0">
                  {([
                    { id: 'providers' as Tab, label: 'Providers', icon: Server },
                    { id: 'chat' as Tab, label: 'Chat', icon: MessageSquare },
                    { id: 'embeddings' as Tab, label: 'Embeddings', icon: Database },
                    { id: 'transcription' as Tab, label: 'Transcription', icon: Mic },
                    { id: 'audio' as Tab, label: 'Audio', icon: Headphones },
                  ]).map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg transition-colors text-left ${
                          activeTab === t.id ? 'bg-elevated text-foreground font-medium' : 'text-foreground-secondary hover:text-foreground hover:bg-elevated/50'
                        }`}>
                        <Icon size={14} className="shrink-0" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Right content panel */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {activeTab === 'providers' && (
                  <>
                    {/* Provider grid */}
                    <div>
                      <label className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider block mb-2">Active Provider</label>
                      <div className="grid grid-cols-4 gap-2">
                        {Object.entries(PROVIDER_META).map(([id, pm]) => {
                          const p = providers.find(x => x.id === id);
                          const sel = selectedId === id;
                          return (
                            <button key={id} onClick={() => handleSelectProvider(id)}
                              className={`flex items-center gap-2 p-3 rounded-lg border text-left ${
                                sel ? 'border-accent-blue bg-card' : 'border-border hover:border-border-hover hover:bg-elevated/50'
                              }`}>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-medium text-foreground">{pm.name}</div>
                                <div className="text-[11px] text-foreground-muted truncate">{pm.description}</div>
                              </div>
                              {p?.available ? <CheckCircle2 size={14} className="text-success shrink-0" /> : <XCircle size={14} className="text-foreground-muted shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Provider config */}
                    {meta && (
                      <div className="space-y-3 border-t border-border pt-4">
                        <div className="text-[13px] font-medium text-foreground">{meta.name} Configuration</div>

                        {meta.needsKey && (
                          <div>
                            <label className="text-[12px] text-foreground-muted block mb-1">API Key</label>
                            {prov?.hasApiKey && !apiKeyInput && (
                              <div className="flex items-center gap-2 text-[12px] text-success mb-1.5">
                                <CheckCircle2 size={12} /> Key saved ({prov.apiKey})
                              </div>
                            )}
                            <div className="relative">
                              <input type={showKey ? 'text' : 'password'} value={apiKeyInput}
                                onChange={e => setApiKeyInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                                placeholder={prov?.hasApiKey ? 'Enter new key to replace...' : (meta.placeholder || 'Enter API key...')}
                                className="w-full px-3 py-2.5 pr-9 bg-input border border-border rounded-lg text-[13px] text-foreground placeholder:text-foreground-muted font-mono focus:ring-1 focus:ring-ring" />
                              <button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground-secondary">
                                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>
                        )}

                        {meta.needsUrl && (
                          <div>
                            <label className="text-[12px] text-foreground-muted block mb-1">Base URL</label>
                            <input type="text" value={urlInput} onChange={e => setUrlInput(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                              placeholder={meta.defaultUrl || 'http://localhost:...'}
                              className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-foreground placeholder:text-foreground-muted font-mono focus:ring-1 focus:ring-ring" />
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          <button onClick={handleSave}
                            className={`px-3 py-1.5 text-[13px] font-medium rounded-lg ${saved ? 'bg-success/20 text-success' : 'bg-primary text-primary-foreground hover:bg-primary/90'}`}>
                            {saved ? 'Saved!' : 'Save'}
                          </button>
                          <button onClick={handleTest} disabled={testing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-transparent border border-border hover:border-border-hover text-foreground-secondary text-[13px] rounded-lg disabled:opacity-50 hover:bg-elevated">
                            {testing && <Loader2 size={13} className="animate-spin" />}
                            Test
                          </button>
                          {testResult !== null && (
                            <span className="flex items-center gap-1.5 text-[12px]">
                              {testResult ? <><CheckCircle2 size={13} className="text-success" /><span className="text-success">Connected</span></>
                                : <><XCircle size={13} className="text-error" /><span className="text-error">Failed</span></>}
                            </span>
                          )}
                        </div>

                        <p className="text-[12px] text-foreground-muted leading-relaxed">{meta.tips}</p>

                        {/* Show what this provider supports */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="px-2 py-0.5 text-[11px] rounded-full bg-accent-blue/10 text-accent-blue">Chat</span>
                          {meta.supportsEmbeddings && <span className="px-2 py-0.5 text-[11px] rounded-full bg-success/10 text-success">Embeddings</span>}
                          {meta.supportsTranscription && <span className="px-2 py-0.5 text-[11px] rounded-full bg-warning/10 text-warning">Transcription</span>}
                          {meta.supportsTTS && <span className="px-2 py-0.5 text-[11px] rounded-full bg-purple-500/10 text-purple-400">TTS</span>}
                        </div>
                      </div>
                    )}
                  </>
                )}
                {activeTab === 'chat' && (
                  <div className="space-y-4">
                    {/* Chat section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={14} className="text-accent-blue" />
                        <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider">Chat</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[12px] text-foreground-muted block mb-1">
                            Provider: <span className="text-foreground font-medium">{PROVIDER_META[activeProvider]?.name}</span>
                            <span className="text-foreground-muted"> (change in Providers tab)</span>
                          </label>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[12px] text-foreground-muted">Model</label>
                            {canListModels.includes(activeProvider) && (
                              <button onClick={() => fetchModels(activeProvider)} disabled={loadingModels}
                                className="flex items-center gap-1 text-[11px] text-foreground-muted hover:text-foreground-secondary transition-colors disabled:opacity-50">
                                <RefreshCw size={10} className={loadingModels ? 'animate-spin' : ''} />
                                {loadingModels ? 'Loading...' : 'Refresh'}
                              </button>
                            )}
                          </div>
                          {fetchedModels.length > 0 ? (
                            <>
                              <select value={chatModelInput}
                                onChange={e => { setChatModelInput(e.target.value); setChatModel(e.target.value); }}
                                className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-foreground font-mono focus:ring-1 focus:ring-ring appearance-none cursor-pointer">
                                {!fetchedModels.some(m => m.id === chatModelInput) && chatModelInput && (
                                  <option value={chatModelInput}>{chatModelInput} (current)</option>
                                )}
                                {fetchedModels.map(m => (
                                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                                ))}
                              </select>
                              <p className="text-[11px] text-foreground-muted mt-1">{fetchedModels.length} model{fetchedModels.length !== 1 ? 's' : ''} loaded on {PROVIDER_META[activeProvider]?.name}.</p>
                            </>
                          ) : canListModels.includes(activeProvider) ? (
                            <div className="px-3 py-3 bg-elevated rounded-lg text-center">
                              {loadingModels ? (
                                <p className="text-[12px] text-foreground-muted flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> Fetching models...</p>
                              ) : (
                                <p className="text-[12px] text-foreground-muted">No models loaded. {activeProvider === 'ollama' ? 'Pull a model below or run "ollama pull" in terminal.' : 'Load a model in LM Studio.'}</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <input type="text" value={chatModelInput}
                                onChange={e => setChatModelInput(e.target.value)}
                                onBlur={saveChatModel}
                                onKeyDown={e => { if (e.key === 'Enter') { saveChatModel(); (e.target as HTMLInputElement).blur(); } }}
                                placeholder={chatPlaceholders[activeProvider] || 'model-name'}
                                className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-foreground placeholder:text-foreground-muted font-mono focus:ring-1 focus:ring-ring" />
                              {/* Suggested models for API providers */}
                              {SUGGESTED_MODELS[activeProvider]?.chat.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {SUGGESTED_MODELS[activeProvider].chat.map(m => (
                                    <button key={m} onClick={() => { setChatModelInput(m); setChatModel(m); }}
                                      className={`px-2 py-0.5 text-[11px] rounded-md border transition-colors ${
                                        chatModelInput === m ? 'bg-accent-blue/10 border-accent-blue/20 text-accent-blue' : 'border-border text-foreground-muted hover:text-foreground-secondary hover:border-border-hover'
                                      }`}>
                                      {m}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <p className="text-[11px] text-foreground-muted mt-1">Click a suggestion or type a custom model name.</p>
                            </>
                          )}

                          {/* Ollama model pull */}
                          {activeProvider === 'ollama' && (
                            <div className="mt-3 space-y-2">
                              <label className="text-[12px] text-foreground-muted block">Download a model</label>
                              <div className="flex gap-2">
                                <input type="text" value={pullModelName}
                                  onChange={e => setPullModelName(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') pullOllamaModel(pullModelName); }}
                                  placeholder="e.g. llama3.2"
                                  disabled={pulling}
                                  className="flex-1 px-3 py-2 bg-input border border-border rounded-lg text-[13px] text-foreground placeholder:text-foreground-muted font-mono focus:ring-1 focus:ring-ring disabled:opacity-50" />
                                <button onClick={() => pullOllamaModel(pullModelName)} disabled={pulling || !pullModelName.trim()}
                                  className="px-3 py-2 text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg disabled:opacity-50 shrink-0">
                                  {pulling ? 'Pulling...' : 'Pull'}
                                </button>
                              </div>
                              {pullProgress && (
                                <p className={`text-[11px] ${pullProgress.startsWith('Error') ? 'text-error' : pullProgress.includes('complete') ? 'text-success' : 'text-foreground-muted'}`}>
                                  {pullProgress}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {OLLAMA_POPULAR.map(m => (
                                  <button key={m.name} onClick={() => setPullModelName(m.name)} disabled={pulling}
                                    title={m.desc}
                                    className="px-2 py-0.5 text-[11px] border border-border rounded-md text-foreground-muted hover:text-foreground-secondary hover:border-border-hover transition-colors disabled:opacity-50">
                                    {m.name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'embeddings' && (
                  <div className="space-y-4">
                    {/* Embeddings section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Database size={14} className="text-success" />
                        <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider">Embeddings</span>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[12px] text-foreground-muted block mb-1">Provider</label>
                          <select value={embeddingProvider}
                            onChange={e => setEmbeddingProvider(e.target.value)}
                            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-foreground focus:ring-1 focus:ring-ring appearance-none cursor-pointer">
                            {EMBEDDING_PROVIDERS.map(ep => (
                              <option key={ep.id} value={ep.id}>{ep.name}</option>
                            ))}
                          </select>
                          <p className="text-[11px] text-foreground-muted mt-1">
                            {embeddingProvider === 'auto'
                              ? 'Uses chat provider if it supports embeddings, otherwise falls back to OpenAI then Ollama.'
                              : `Embeddings will use ${EMBEDDING_PROVIDERS.find(p => p.id === embeddingProvider)?.name}. Make sure it's configured in the Providers tab.`}
                          </p>
                        </div>
                        <div>
                          <label className="text-[12px] text-foreground-muted block mb-1">Model</label>
                          <input type="text" value={embedModelInput}
                            onChange={e => setEmbedModelInput(e.target.value)}
                            onBlur={saveEmbedModel}
                            onKeyDown={e => { if (e.key === 'Enter') { saveEmbedModel(); (e.target as HTMLInputElement).blur(); } }}
                            placeholder={embedPlaceholders[embeddingProvider] || 'embedding-model-name'}
                            className="w-full px-3 py-2.5 bg-input border border-border rounded-lg text-[13px] text-foreground placeholder:text-foreground-muted font-mono focus:ring-1 focus:ring-ring" />
                          <p className="text-[11px] text-foreground-muted mt-1">Type exact embedding model name.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'transcription' && (
                  <div className="space-y-4">
                    {/* Transcription section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Mic size={14} className="text-warning" />
                        <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider">Transcription</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[12px] text-foreground-muted block mb-1">Provider</label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { id: 'openai', name: 'OpenAI Whisper', desc: 'API key required', keyProvider: 'openai' },
                              { id: 'groq', name: 'Groq Whisper', desc: 'Ultra-fast, free tier', keyProvider: 'groq' },
                              { id: 'local', name: 'Local Whisper', desc: 'Offline, no key needed', keyProvider: null },
                            ] as const).map(tp => {
                              const isSelected = transcriptionProvider === tp.id;
                              const hasKey = tp.keyProvider ? providers.find(p => p.id === tp.keyProvider)?.hasApiKey : true;
                              return (
                                <button key={tp.id} onClick={() => { setTranscriptionProvider(tp.id); if (tp.id === 'local') fetchWhisperModels(); }}
                                  className={`p-3 rounded-lg border text-left transition-colors ${
                                    isSelected ? 'border-accent-blue bg-accent-blue/5' : 'border-border hover:border-border-hover hover:bg-elevated/50'
                                  }`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[12px] font-medium text-foreground">{tp.name}</span>
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                      isSelected ? 'border-accent-blue' : 'border-foreground-muted/40'
                                    }`}>
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-foreground-muted">{tp.desc}</div>
                                  {!isSelected && tp.keyProvider && !hasKey && (
                                    <div className="text-[9px] text-warning mt-1">Needs API key</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Local Whisper model catalog */}
                        {transcriptionProvider === 'local' && (
                          <div className="space-y-2">
                            <label className="text-[12px] text-foreground-muted block">Local Models</label>
                            {whisperDownloadStatus && (
                              <p className={`text-[11px] px-3 py-2 rounded-lg ${whisperDownloadStatus.startsWith('Error') ? 'bg-error/10 text-error' : whisperDownloadStatus.includes('complete') ? 'bg-success/10 text-success' : 'bg-elevated text-foreground-muted'}`}>
                                {whisperDownloadStatus}
                              </p>
                            )}
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {whisperModels.map(m => {
                                const isActive = localWhisperModel === m.id;
                                const isDownloading = downloadingWhisper === m.id;
                                return (
                                  <div key={m.id}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      isActive ? 'border-accent-blue bg-accent-blue/5' : 'border-border hover:border-border-hover'
                                    }`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-[12px] font-medium text-foreground">{m.name}</span>
                                          {m.language === 'English' && (
                                            <span className="px-1.5 py-0 text-[9px] rounded bg-accent-blue/10 text-accent-blue">English</span>
                                          )}
                                          {m.language === 'Multilingual' && (
                                            <span className="px-1.5 py-0 text-[9px] rounded bg-success/10 text-success">Multilingual</span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-foreground-muted leading-relaxed mb-1.5">{m.description}</p>
                                        <div className="flex items-center gap-3 text-[10px] text-foreground-muted">
                                          <span>Accuracy {'●'.repeat(m.accuracy)}{'○'.repeat(5 - m.accuracy)}</span>
                                          <span>Speed {'●'.repeat(m.speed)}{'○'.repeat(5 - m.speed)}</span>
                                          <span>{m.size}</span>
                                        </div>
                                      </div>
                                      <div className="shrink-0">
                                        {m.downloaded ? (
                                          <button onClick={() => setLocalWhisperModel(m.id)}
                                            className={`px-3 py-1.5 text-[11px] font-medium rounded-lg transition-colors ${
                                              isActive ? 'bg-accent-blue text-white' : 'bg-elevated text-foreground-secondary hover:bg-card-hover'
                                            }`}>
                                            {isActive ? 'Active' : 'Use'}
                                          </button>
                                        ) : (
                                          <button onClick={() => downloadWhisperModel(m.id)}
                                            disabled={isDownloading || downloadingWhisper !== null}
                                            className="px-3 py-1.5 text-[11px] font-medium bg-accent-blue text-white hover:bg-accent-blue/90 rounded-lg disabled:opacity-50 transition-colors">
                                            {isDownloading ? 'Downloading...' : 'Download'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {whisperModels.length === 0 && (
                                <div className="text-center py-4">
                                  <Loader2 size={14} className="animate-spin mx-auto mb-2 text-foreground-muted" />
                                  <p className="text-[11px] text-foreground-muted">Loading available models...</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <p className="text-[11px] text-foreground-muted">
                          {transcriptionProvider === 'local'
                            ? 'Runs entirely on your machine — no API key or internet needed after download. Images use local OCR (Tesseract.js).'
                            : 'Used for audio and video files. Configure the API key in the Providers tab. Images use local OCR (Tesseract.js).'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'audio' && (
                  <div className="space-y-4">
                    {/* Audio Overview / TTS section */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Headphones size={14} className="text-purple-400" />
                        <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider">Audio Overview (TTS)</span>
                      </div>
                      <div className="space-y-3">
                        {/* TTS Provider selection */}
                        <div>
                          <label className="text-[12px] text-foreground-muted block mb-1">Provider</label>
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { id: 'openai', name: 'OpenAI TTS', desc: 'High quality, API key required', needsKey: true },
                              { id: 'kokoro', name: 'Kokoro (Local)', desc: 'Free, offline, 54 voices', needsKey: false },
                            ] as const).map(tp => {
                              const isSelected = ttsProvider === tp.id;
                              return (
                                <button key={tp.id} onClick={() => setTTSProvider(tp.id)}
                                  className={`p-3 rounded-lg border text-left transition-colors ${isSelected ? 'border-accent-blue bg-accent-blue/5' : 'border-border hover:border-border-hover hover:bg-elevated/50'}`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[12px] font-medium text-foreground">{tp.name}</span>
                                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                                      isSelected ? 'border-accent-blue' : 'border-foreground-muted/40'
                                    }`}>
                                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />}
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-foreground-muted">{tp.desc}</div>
                                  {!isSelected && tp.needsKey && !hasOpenAIKey && (
                                    <div className="text-[9px] text-warning mt-1">Needs API key</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Voice config — depends on speaker count */}
                        {ttsProvider === 'openai' && podcastSpeakers === 1 && (
                          <div>
                            <label className="text-[12px] text-foreground-muted block mb-1">Solo Voice</label>
                            <div className="grid grid-cols-3 gap-1.5">
                              {TTS_VOICES.map(v => (
                                <button key={v.id} onClick={() => setTTSVoice(v.id)}
                                  className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                                    ttsVoice === v.id ? 'border-accent-blue bg-accent-blue/5' : 'border-border hover:border-border-hover hover:bg-elevated/50'
                                  }`}>
                                  <div className="text-[12px] font-medium text-foreground">{v.name}</div>
                                  <div className="text-[10px] text-foreground-muted">{v.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {ttsProvider === 'openai' && podcastSpeakers > 1 && (
                          <div>
                            <label className="text-[12px] text-foreground-muted block mb-1">Speaker Voices</label>
                            <div className="space-y-1">
                              {(['Alex', 'Sam', 'Jordan', 'Riley'] as const).slice(0, podcastSpeakers).map(name => {
                                const voiceMap: Record<string, string> = { Alex: 'Onyx (deep male)', Sam: 'Nova (warm female)', Jordan: 'Echo (smooth male)', Riley: 'Shimmer (clear female)' };
                                return (
                                  <div key={name} className="flex items-center justify-between px-3 py-1.5 bg-elevated rounded-lg text-[12px]">
                                    <span className="text-foreground font-medium">{name}</span>
                                    <span className="text-foreground-muted">{voiceMap[name]}</span>
                                  </div>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-foreground-muted mt-1">Each speaker is automatically assigned a distinct voice.</p>
                          </div>
                        )}

                        {/* Kokoro settings */}
                        {ttsProvider === 'kokoro' && (
                          <div className="space-y-2">
                            <div>
                              <label className="text-[12px] text-foreground-muted block mb-1">Server URL</label>
                              <input type="text" value={kokoroUrl}
                                onChange={e => setKokoroUrl(e.target.value)}
                                placeholder="http://localhost:8787"
                                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-[13px] text-foreground font-mono placeholder:text-foreground-muted focus:ring-1 focus:ring-ring" />
                            </div>
                            <div>
                              <label className="text-[12px] text-foreground-muted block mb-1">Voice</label>
                              <select value={kokoroVoice} onChange={e => setKokoroVoice(e.target.value)}
                                className="w-full px-3 py-2 bg-input border border-border rounded-lg text-[13px] text-foreground focus:ring-1 focus:ring-ring appearance-none cursor-pointer">
                                <optgroup label="American English">
                                  <option value="af_heart">Heart (Female)</option>
                                  <option value="af_bella">Bella (Female)</option>
                                  <option value="af_nicole">Nicole (Female)</option>
                                  <option value="af_sarah">Sarah (Female)</option>
                                  <option value="af_sky">Sky (Female)</option>
                                  <option value="am_adam">Adam (Male)</option>
                                  <option value="am_michael">Michael (Male)</option>
                                </optgroup>
                                <optgroup label="British English">
                                  <option value="bf_emma">Emma (Female)</option>
                                  <option value="bm_george">George (Male)</option>
                                  <option value="bm_lewis">Lewis (Male)</option>
                                </optgroup>
                              </select>
                            </div>
                            <div className="px-3 py-2.5 bg-elevated rounded-lg">
                              <p className="text-[11px] text-foreground-muted leading-relaxed">
                                <strong className="text-foreground">Setup:</strong> Run the Kokoro server locally:
                              </p>
                              <code className="block mt-1 text-[11px] text-accent-blue font-mono">
                                pip install kokoro&gt;=0.9.2 soundfile flask<br/>
                                python scripts/kokoro-server.py
                              </code>
                            </div>
                          </div>
                        )}

                        {/* Podcast speaker count */}
                        <div>
                          <label className="text-[12px] text-foreground-muted block mb-1">Podcast Speakers</label>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map(n => (
                              <button key={n} onClick={() => setPodcastSpeakers(n)}
                                className={`flex-1 py-2 rounded-lg border text-center transition-colors ${
                                  podcastSpeakers === n ? 'border-accent-blue bg-accent-blue/5 text-foreground' : 'border-border text-foreground-muted hover:border-border-hover hover:text-foreground-secondary'
                                }`}>
                                <div className="text-[13px] font-medium">{n}</div>
                                <div className="text-[10px] text-foreground-muted">{n === 1 ? 'Solo' : `${n} hosts`}</div>
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-foreground-muted mt-1">
                            {podcastSpeakers === 1 ? 'Alex narrates solo' : `Hosts: ${['Alex', 'Sam', 'Jordan', 'Riley'].slice(0, podcastSpeakers).join(', ')}`}
                          </p>
                        </div>

                        <p className="text-[11px] text-foreground-muted">
                          {ttsProvider === 'kokoro'
                            ? 'Kokoro is an 82M parameter TTS model. Runs locally, Apache licensed, 54 voices across 8 languages.'
                            : 'The podcast script is generated using your chat model. TTS audio requires an OpenAI API key. Without a key, you\'ll still get the script text.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
