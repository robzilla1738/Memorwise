import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  return NextResponse.json(queries.listTags(notebookId));
}

export async function POST(req: Request) {
  const { notebookId, name, color } = await req.json();
  if (!notebookId || !name) {
    return NextResponse.json({ error: 'notebookId and name required' }, { status: 400 });
  }
  const tag = queries.createTag(notebookId, name, color);
  return NextResponse.json(tag);
}
