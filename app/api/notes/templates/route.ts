import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET() {
  return NextResponse.json(queries.listNoteTemplates());
}

export async function POST(req: Request) {
  const { name, content } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const template = queries.createNoteTemplate(name, content || '');
  return NextResponse.json(template);
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  queries.deleteNoteTemplate(id);
  return NextResponse.json({ success: true });
}
