import { NextResponse } from 'next/server';
import { generateStudyGuide } from '@/lib/generate';
import { createNote } from '@/lib/db/queries';

export async function POST(req: Request) {
  const { notebookId } = await req.json();
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  try {
    const content = await generateStudyGuide(notebookId);
    const note = createNote(notebookId, 'Study Guide', content);
    return NextResponse.json(note);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
