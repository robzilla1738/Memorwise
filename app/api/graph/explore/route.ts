import { NextResponse } from 'next/server';
import { registry } from '@/lib/llm/provider-registry';
import { getNotebookContext } from '@/lib/generate';
import * as queries from '@/lib/db/queries';

export async function POST(req: Request) {
  const { notebookId, concept } = await req.json();
  if (!notebookId || !concept) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  // Get document context (no RAG needed — we want broad coverage for concept exploration)
  const context = getNotebookContext(notebookId, 5000);
  if (!context.trim()) return NextResponse.json({ error: 'No readable sources' }, { status: 400 });

  const provider = registry.getActiveProvider();
  const model = registry.getActiveChatModel();
  const sourceNames = queries.listSources(notebookId).filter(s => s.status === 'ready' || s.status === 'error').map(s => s.filename);

  const systemPrompt = [
    'You are a research assistant analyzing documents for the user.',
    `The user wants to know what their documents say about "${concept}".`,
    `Documents loaded: ${sourceNames.join(', ')}`,
    '',
    'Instructions:',
    '- Explain what the documents say about this concept specifically.',
    '- Quote or paraphrase relevant passages.',
    '- Mention which document each point comes from.',
    '- Be thorough but concise (3-5 paragraphs).',
    '- If the documents don\'t discuss this concept much, say so.',
    '',
    'DOCUMENT CONTEXT:',
    context,
  ].join('\n');

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await provider.generateStream(
          { model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `What do my documents say about "${concept}"?` }] },
          {
            onToken: (token) => { controller.enqueue(encoder.encode(JSON.stringify({ type: 'token', content: token }) + '\n')); },
            onComplete: (fullText) => { controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', fullText }) + '\n')); controller.close(); },
            onError: (error) => { controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error.message }) + '\n')); controller.close(); },
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: msg }) + '\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}
