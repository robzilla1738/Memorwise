import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  const type = searchParams.get('type') || undefined;
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  return NextResponse.json(queries.listGenerations(notebookId, type));
}

export async function POST(req: Request) {
  const { notebookId, type, title, content } = await req.json();
  if (!notebookId || !type || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const gen = queries.saveGeneration(notebookId, type, title, content || '');
  return NextResponse.json(gen);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  queries.deleteGeneration(id);
  return NextResponse.json({ success: true });
}
