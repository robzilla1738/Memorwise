import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';
import { deleteNotebookTable } from '@/lib/rag/vectorstore';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, description } = await req.json();
  queries.updateNotebook(id, name, description);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteNotebookTable(id);
  queries.deleteNotebook(id);
  return NextResponse.json({ success: true });
}
