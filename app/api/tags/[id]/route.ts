import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  queries.deleteTag(id);
  return NextResponse.json({ success: true });
}
