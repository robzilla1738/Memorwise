import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';
import { deleteSourceChunks } from '@/lib/rag/vectorstore';
import { ingestSource } from '@/lib/rag/ingest';

export async function POST(req: Request) {
  const { notebookId } = await req.json();
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  const sources = queries.listSources(notebookId).filter(s => s.status === 'ready' || s.status === 'error');
  let queued = 0;

  for (const source of sources) {
    await deleteSourceChunks(source.notebook_id, source.id);
    queries.updateSourceStatus(source.id, 'pending');
    ingestSource(source.id, source.notebook_id, source.filepath, source.filetype, source.source_type || 'file');
    queued++;
  }

  return NextResponse.json({ success: true, queued });
}
