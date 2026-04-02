import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';

export async function POST(req: Request) {
  const { sessionId, notebookId, upToMessageId } = await req.json();
  if (!sessionId || !notebookId) return NextResponse.json({ error: 'sessionId and notebookId required' }, { status: 400 });

  // Get all messages up to (and including) the specified message
  const allMessages = queries.getMessages(sessionId);
  const cutoffIdx = upToMessageId
    ? allMessages.findIndex(m => m.id === upToMessageId)
    : allMessages.length - 1;

  if (cutoffIdx < 0) return NextResponse.json({ error: 'Message not found' }, { status: 404 });

  const messagesToCopy = allMessages.slice(0, cutoffIdx + 1);

  // Create new session
  const originalSession = queries.listChatSessions(notebookId).find(s => s.id === sessionId);
  const title = `Fork: ${originalSession?.title || 'Chat'}`;
  const newSession = queries.createChatSession(notebookId, title);

  // Copy messages into new session
  for (const msg of messagesToCopy) {
    queries.saveMessage(newSession.id, msg.role, msg.content, msg.citations || undefined);
  }

  return NextResponse.json(newSession);
}
