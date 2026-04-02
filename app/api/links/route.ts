import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function POST(req: Request) {
  const { notebookId, fromId, fromType, toId, toType } = await req.json();
  if (!notebookId || !fromId || !fromType || !toId || !toType) {
    return NextResponse.json({ error: 'notebookId, fromId, fromType, toId, and toType required' }, { status: 400 });
  }
  const link = queries.createLink(notebookId, fromId, fromType, toId, toType);
  return NextResponse.json(link);
}
