import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(queries.getMessages(id));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  queries.deleteChatSession(id);
  return NextResponse.json({ success: true });
}
