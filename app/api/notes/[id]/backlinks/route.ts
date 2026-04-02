import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(queries.getBacklinks(id));
}
