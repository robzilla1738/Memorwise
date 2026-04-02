import { NextResponse } from 'next/server';
import { generateSuggestions } from '@/lib/generate';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  try {
    const suggestions = await generateSuggestions(notebookId);
    return NextResponse.json(suggestions);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
