import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { name, parentId } = await req.json();
  queries.updateFolder(id, name, parentId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  queries.deleteFolder(id);
  return NextResponse.json({ success: true });
}
