import { NextResponse } from 'next/server';
import { registry } from '@/lib/llm/provider-registry';
import { getNotebookContext } from '@/lib/generate';

export async function POST(req: Request) {
  const { notebookId, count = 10 } = await req.json();
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  let context: string;
  try {
    context = getNotebookContext(notebookId, 2500);
  } catch {
    return NextResponse.json({ error: 'Failed to read sources' }, { status: 500 });
  }
  if (!context.trim()) return NextResponse.json({ error: 'No readable sources. Add documents to your notebook first.' }, { status: 400 });

  const provider = registry.getActiveProvider();
  const model = registry.getActiveChatModel();

  try {
    const result = await provider.generate({
      model,
      messages: [
        {
          role: 'system',
          content: `Generate exactly ${count} multiple-choice quiz questions. Return ONLY a JSON array where each item has: "question" (string), "options" (array of 4 strings), "correctIndex" (0-3 number), "explanation" (string). No markdown, no extra text.`
        },
        { role: 'user', content: `Create quiz questions from:\n\n${context}` },
      ],
    });

    const match = result.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Failed to parse quiz');
    const questions = JSON.parse(match[0]).slice(0, 15);
    return NextResponse.json(questions);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
