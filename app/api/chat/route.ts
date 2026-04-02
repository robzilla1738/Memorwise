import * as queries from '@/lib/db/queries';
import { retrieveContext } from '@/lib/rag/retrieve';
import { registry } from '@/lib/llm/provider-registry';

export async function POST(req: Request) {
  const { sessionId, notebookId, message, sourceId } = await req.json();
  if (!sessionId || !message) return new Response('Missing fields', { status: 400 });

  // Save user message
  queries.saveMessage(sessionId, 'user', message);

  // Auto-title
  const allMsgs = queries.getMessages(sessionId);
  const userMessages = allMsgs.filter(m => m.role === 'user');
  if (userMessages.length === 1) {
    queries.updateChatSessionTitle(sessionId, message.length > 40 ? message.slice(0, 40) + '...' : message);
  }

  // RAG retrieval — try vector search first, fall back to raw text if needed
  let context = '';
  let citations: { source_id: string; filename: string; chunk_text: string; score: number }[] = [];
  let ragFailed = false;

  try {
    const r = await retrieveContext(notebookId, message, 8, sourceId || undefined);
    context = r.context;
    citations = r.citations;
  } catch (err) {
    console.error('RAG retrieval failed:', err);
    ragFailed = true;
  }

  // Fallback: if RAG returned nothing (or failed) and sources exist, use raw notebook context
  // This handles: vague queries, embedding provider mismatch, dimension errors, provider switching
  if (!context && notebookId) {
    const readySources = queries.listSources(notebookId).filter(s => s.status === 'ready');
    if (readySources.length > 0) {
      try {
        const { getNotebookContext } = await import('@/lib/generate');
        const fallbackContext = getNotebookContext(notebookId, 4000);
        if (fallbackContext.trim()) {
          context = fallbackContext;
          citations = readySources.map(s => ({ source_id: s.id, filename: s.filename, chunk_text: '', score: 1 }));
        }
      } catch { /* fallback failed too */ }
    }
  }

  const sourceFilter = sourceId ? queries.getSource(sourceId) : null;
  const sourceNames = [...new Set(citations.map(c => c.filename))];
  const allSources = queries.listSources(notebookId).filter(s => s.status === 'ready');
  const allSourceNames = allSources.map(s => s.filename);
  const hasSources = allSources.length > 0;

  let systemPrompt: string;
  if (context) {
    const focusLine = sourceFilter ? `You are specifically answering questions about "${sourceFilter.filename}".` : '';
    systemPrompt = [
      'You are a knowledgeable research assistant for Memorwise, a document analysis tool.',
      focusLine,
      'The user has uploaded documents and is asking questions about them.',
      '',
      'INSTRUCTIONS:',
      '- Answer the user\'s question using ONLY the provided document context below.',
      '- Be direct, specific, and thorough. Synthesize information across sources when relevant.',
      '- Cite your sources using [1], [2], etc. corresponding to the numbered excerpts.',
      '- If the context doesn\'t contain enough information to fully answer, say so clearly and answer what you can.',
      '- Do NOT make up information not found in the context.',
      '- If a source is an image or screenshot, the context contains OCR-extracted text from it — describe what the document contains, not the raw OCR output.',
      `- The user\'s documents include: ${sourceNames.join(', ')}`,
      '',
      'DOCUMENT CONTEXT:',
      context,
    ].filter(Boolean).join('\n');
  } else if (hasSources) {
    // Sources exist but RAG didn't find relevant chunks for this query
    systemPrompt = [
      'You are a knowledgeable research assistant for Memorwise, a document analysis tool.',
      `The user has ${allSources.length} document${allSources.length > 1 ? 's' : ''} loaded: ${allSourceNames.join(', ')}.`,
      'The current question did not match any specific document content, but the documents are available.',
      '',
      'INSTRUCTIONS:',
      '- If the user asks about their documents, let them know what sources are loaded and suggest they ask specific questions about the content.',
      '- For general questions, answer helpfully while reminding them you can help analyze their documents.',
      '- Do NOT say "no documents are indexed" — documents ARE loaded.',
      '- You are Memorwise, a document research assistant. Do not reveal internal model details.',
    ].join('\n');
  } else {
    systemPrompt = 'You are a helpful research assistant for Memorwise. No documents have been indexed in this notebook yet. Let the user know they should add sources (PDFs, URLs, images, audio, etc.) to start chatting about their documents. You can still answer general questions to the best of your ability.';
  }

  const history = queries.getMessages(sessionId);
  const recentHistory = history.slice(-11, -1);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const provider = registry.getActiveProvider();
  const model = registry.getActiveChatModel();

  // Compute context metadata
  const uniqueSources = new Set(citations.map(c => c.source_id));
  const totalChunks = queries.listSources(notebookId).reduce((sum, s) => sum + (s.chunk_count || 0), 0);
  const contextMeta = { chunksUsed: citations.length, totalChunks, sourcesUsed: uniqueSources.size };

  // Stream via ReadableStream + NDJSON
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Send context metadata first
      controller.enqueue(encoder.encode(JSON.stringify({ type: 'context', ...contextMeta }) + '\n'));
      try {
        await provider.generateStream(
          { model, messages },
          {
            onToken: (token) => {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'token', content: token }) + '\n'));
            },
            onComplete: async (fullText) => {
              const saved = queries.saveMessage(sessionId, 'assistant', fullText, citations);
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', messageId: saved.id, fullText, citations }) + '\n'));
              controller.close();
            },
            onError: (error) => {
              controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', message: error.message }) + '\n'));
              controller.close();
            },
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
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
