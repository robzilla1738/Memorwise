import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';
import { deleteSourceChunks } from '@/lib/rag/vectorstore';
import { ingestSource } from '@/lib/rag/ingest';

export async function POST(req: Request) {
  const { sourceId } = await req.json();
  if (!sourceId) return NextResponse.json({ error: 'sourceId required' }, { status: 400 });

  const source = queries.getSource(sourceId);
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

  // Delete old chunks and re-ingest
  await deleteSourceChunks(source.notebook_id, sourceId);
  queries.updateSourceStatus(sourceId, 'pending');

  // Async re-ingestion
  ingestSource(sourceId, source.notebook_id, source.filepath, source.filetype, source.source_type || 'file');

  return NextResponse.json({ success: true, status: 'reindexing' });
}
