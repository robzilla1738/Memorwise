import { registry } from '../llm/provider-registry';

// Default embedding models per provider — used when stored model doesn't match the resolved provider
const DEFAULT_EMBED_MODELS: Record<string, string> = {
  ollama: 'nomic-embed-text',
  openai: 'text-embedding-3-small',
  gemini: 'text-embedding-004',
  mistral: 'mistral-embed',
  lmstudio: 'text-embedding-nomic-embed-text-v1.5',
};

function getEmbeddingModel(providerId: string): string {
  const stored = registry.getActiveEmbeddingModel();
  const explicitProvider = registry.getEmbeddingProviderId();

  // If user explicitly chose an embedding provider, trust their model choice
  if (explicitProvider !== 'auto') return stored;

  // Only auto-correct when provider is 'auto' (fallback mode) and model doesn't match resolved provider
  // This prevents e.g. sending "text-embedding-nomic-embed-text-v1.5" to OpenAI
  if (providerId === 'openai' && !stored.startsWith('text-embedding-3')) return DEFAULT_EMBED_MODELS.openai;
  if (providerId === 'gemini' && !stored.startsWith('text-embedding-004')) return DEFAULT_EMBED_MODELS.gemini;
  if (providerId === 'mistral' && !stored.startsWith('mistral')) return DEFAULT_EMBED_MODELS.mistral;

  return stored;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const provider = registry.getEmbeddingProvider();
  if (!provider.embed) {
    throw new Error(
      `Provider "${provider.name}" does not support embeddings. ` +
      `Go to Settings → Models & Tasks → Embeddings and select a provider that supports embeddings (Ollama, OpenAI, Gemini, Mistral, or LM Studio).`
    );
  }
  const model = getEmbeddingModel(provider.id);
  try {
    return await provider.embed({ model, texts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Detect common provider-specific errors and give actionable messages
    if (msg.includes('ECONNREFUSED')) {
      throw new Error(`Cannot connect to ${provider.name} for embeddings. Make sure it's running and the URL is correct in Settings.`);
    }
    if (msg.includes('No models loaded') || msg.includes('lms load')) {
      throw new Error(`${provider.name} has no model loaded. Load an embedding model in ${provider.name}, or switch to a different embedding provider in Settings.`);
    }
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('API key')) {
      throw new Error(`${provider.name} embedding failed: invalid or missing API key. Check your API key in Settings.`);
    }
    if (msg.includes('404') || msg.includes('not found')) {
      throw new Error(`Embedding model "${model}" not found on ${provider.name}. Check the model name in Settings → Embeddings.`);
    }
    throw new Error(`Embedding failed (${provider.name}): ${msg}`);
  }
}

export async function embedQuery(text: string): Promise<number[]> {
  const results = await embedTexts([text]);
  return results[0];
}
