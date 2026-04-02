import { NextResponse } from 'next/server';
import fs from 'fs';
import * as queries from '@/lib/db/queries';
import { deleteSourceChunks } from '@/lib/rag/vectorstore';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = queries.getSource(id);
  if (source) {
    await deleteSourceChunks(source.notebook_id, id);
    try { fs.unlinkSync(source.filepath); } catch {}
    queries.deleteSource(id);
  }
  return NextResponse.json({ success: true });
}
