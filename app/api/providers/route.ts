import { NextResponse } from 'next/server';
import { registry } from '@/lib/llm/provider-registry';

export async function GET() {
  const providers = registry.getAllProviders();
  const result = [];
  for (const p of providers) {
    const available = await p.isAvailable();
    const config = registry.getProviderConfig(p.id);
    result.push({ id: p.id, name: p.name, available, ...config });
  }
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { providerId, action, apiKey, baseUrl, modelName } = await req.json();

  if (action === 'test') {
    const provider = registry.getProvider(providerId);
    if (!provider) return NextResponse.json({ available: false });
    return NextResponse.json({ available: await provider.isAvailable() });
  }

  if (action === 'configure') {
    registry.setProviderConfig(providerId, { apiKey, baseUrl });
    return NextResponse.json({ success: true });
  }

  if (action === 'models') {
    const provider = registry.getProvider(providerId);
    if (!provider) return NextResponse.json([]);
    return NextResponse.json(await provider.listModels());
  }

  if (action === 'pull') {
    if (providerId !== 'ollama') return NextResponse.json({ error: 'Only Ollama supports model pulling' }, { status: 400 });
    if (!modelName) return NextResponse.json({ error: 'modelName required' }, { status: 400 });
    try {
      const stream = await registry.ollama.pullModel(modelName);
      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Pull failed' }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
