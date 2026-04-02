import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';

interface SearchResult {
  id: string;
  type: 'source' | 'note' | 'message';
  title: string;
  snippet: string;
  notebookId?: string;
  sessionId?: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q')?.trim();
  const notebookId = searchParams.get('notebookId');
  if (!query || !notebookId) return NextResponse.json([]);

  const db = getDb();
  const like = `%${query}%`;
  const results: SearchResult[] = [];

  // Search sources by filename
  const sources = db.prepare(
    'SELECT id, filename, summary FROM sources WHERE notebook_id = ? AND (filename LIKE ? OR summary LIKE ?) LIMIT 10'
  ).all(notebookId, like, like) as any[];
  for (const s of sources) {
    results.push({
      id: s.id, type: 'source', title: s.filename,
      snippet: s.summary ? s.summary.slice(0, 120) + '...' : 'Source file',
    });
  }

  // Search notes by title and content
  const notes = db.prepare(
    'SELECT id, title, content FROM notes WHERE notebook_id = ? AND (title LIKE ? OR content LIKE ?) LIMIT 10'
  ).all(notebookId, like, like) as any[];
  for (const n of notes) {
    const idx = (n.content || '').toLowerCase().indexOf(query.toLowerCase());
    const snippet = idx >= 0 ? '...' + n.content.slice(Math.max(0, idx - 30), idx + 100) + '...' : n.content?.slice(0, 120) || '';
    results.push({ id: n.id, type: 'note', title: n.title || 'Untitled', snippet });
  }

  // Search chat messages
  const messages = db.prepare(`
    SELECT m.id, m.content, m.role, cs.title as session_title, cs.id as session_id
    FROM messages m JOIN chat_sessions cs ON m.session_id = cs.id
    WHERE cs.notebook_id = ? AND m.content LIKE ? AND m.role = 'assistant'
    LIMIT 10
  `).all(notebookId, like) as any[];
  for (const m of messages) {
    const idx = m.content.toLowerCase().indexOf(query.toLowerCase());
    const snippet = idx >= 0 ? '...' + m.content.slice(Math.max(0, idx - 30), idx + 100) + '...' : m.content.slice(0, 120);
    results.push({
      id: m.id, type: 'message', title: `Chat: ${m.session_title || 'Untitled'}`,
      snippet, sessionId: m.session_id,
    });
  }

  return NextResponse.json(results.slice(0, 20));
}
