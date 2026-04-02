import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const note = queries.getNote(id);
  if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
  return NextResponse.json(note);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { title, content, folderId } = await req.json();
  queries.updateNote(id, title, content, folderId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  queries.deleteNote(id);
  return NextResponse.json({ success: true });
}
