import { NextResponse } from 'next/server';
import { WHISPER_MODELS, isModelDownloaded, downloadModel } from '@/lib/rag/local-whisper';

export async function GET() {
  const models = WHISPER_MODELS.map(m => ({
    ...m,
    downloaded: isModelDownloaded(m.id),
  }));
  return NextResponse.json(models);
}

export async function POST(req: Request) {
  const { action, modelId } = await req.json();

  if (action === 'download') {
    if (!modelId) return NextResponse.json({ error: 'modelId required' }, { status: 400 });
    const model = WHISPER_MODELS.find(m => m.id === modelId);
    if (!model) return NextResponse.json({ error: 'Unknown model' }, { status: 400 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await downloadModel(modelId, (status) => {
            controller.enqueue(encoder.encode(JSON.stringify({ status }) + '\n'));
          });
          controller.enqueue(encoder.encode(JSON.stringify({ status: 'complete', success: true }) + '\n'));
        } catch (err) {
          controller.enqueue(encoder.encode(JSON.stringify({ status: 'error', error: err instanceof Error ? err.message : 'Download failed' }) + '\n'));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  }

  if (action === 'check') {
    if (!modelId) return NextResponse.json({ error: 'modelId required' }, { status: 400 });
    return NextResponse.json({ downloaded: isModelDownloaded(modelId) });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
