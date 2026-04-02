import { NextResponse } from 'next/server';
import { generateSourceSummary, generateNotebookSummary } from '@/lib/generate';

export async function POST(req: Request) {
  const { sourceId, notebookId } = await req.json();
  if (!sourceId && !notebookId) return NextResponse.json({ error: 'sourceId or notebookId required' }, { status: 400 });

  try {
    const summary = sourceId
      ? await generateSourceSummary(sourceId)
      : await generateNotebookSummary(notebookId);
    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
