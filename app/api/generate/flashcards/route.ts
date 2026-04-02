import { NextResponse } from 'next/server';
import { generateFlashcards } from '@/lib/generate';

export async function POST(req: Request) {
  const { notebookId } = await req.json();
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  try {
    const flashcards = await generateFlashcards(notebookId);
    return NextResponse.json(flashcards);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
