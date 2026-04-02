import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET() {
  return NextResponse.json(queries.listNotebooks());
}

export async function POST(req: Request) {
  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const notebook = queries.createNotebook(name, description);
  return NextResponse.json(notebook);
}
