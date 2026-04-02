import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  return NextResponse.json(queries.listNotes(notebookId));
}

export async function POST(req: Request) {
  const { notebookId, title, content, folderId } = await req.json();
  if (!notebookId) {
    return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  }
  const note = queries.createNote(notebookId, title, content, folderId);
  return NextResponse.json(note);
}
