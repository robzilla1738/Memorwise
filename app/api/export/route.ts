import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';
import fs from 'fs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  const type = searchParams.get('type') || 'notebook'; // notebook | note | chat
  const id = searchParams.get('id'); // for single note/chat export

  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  const notebook = queries.getNotebook(notebookId);
  if (!notebook) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 });

  // Single note export
  if (type === 'note' && id) {
    const note = queries.getNote(id);
    if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    const md = `# ${note.title}\n\n${note.content}`;
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${note.title.replace(/[^a-zA-Z0-9]/g, '_')}.md"`,
      },
    });
  }

  // Single chat export
  if (type === 'chat' && id) {
    const messages = queries.getMessages(id);
    let md = `# Chat Export\n\n`;
    for (const m of messages) {
      md += `## ${m.role === 'user' ? 'You' : 'Memorwise'}\n\n${m.content}\n\n---\n\n`;
    }
    return new Response(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="chat_export.md"`,
      },
    });
  }

  // Full notebook export as JSON manifest + markdown files
  const sources = queries.listSources(notebookId);
  const notes = queries.listNotes(notebookId);
  const sessions = queries.listChatSessions(notebookId);

  const exportData: Record<string, string> = {};

  // README
  exportData['README.md'] = `# ${notebook.name}\n\nExported from Memorwise on ${new Date().toISOString()}\n\n## Contents\n- ${sources.length} sources\n- ${notes.length} notes\n- ${sessions.length} chat sessions\n`;

  // Notes as markdown
  for (const note of notes) {
    const safeName = note.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    exportData[`notes/${safeName}.md`] = `# ${note.title}\n\n${note.content}`;
  }

  // Chat sessions as markdown
  for (const session of sessions) {
    const messages = queries.getMessages(session.id);
    let md = `# ${session.title || 'Chat'}\n\n`;
    for (const m of messages) {
      md += `**${m.role === 'user' ? 'You' : 'Memorwise'}:**\n\n${m.content || ''}\n\n---\n\n`;
    }
    const safeName = (session.title || 'chat').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);
    exportData[`chats/${safeName}.md`] = md;
  }

  // Sources manifest
  exportData['sources.json'] = JSON.stringify(sources.map(s => ({
    filename: s.filename, type: s.source_type, filetype: s.filetype,
    chunks: s.chunk_count, status: s.status, summary: s.summary,
  })), null, 2);

  // Source content (text-only)
  for (const src of sources) {
    if (['image', 'audio', 'video'].includes(src.source_type)) continue;
    try {
      const content = fs.readFileSync(src.filepath, 'utf-8');
      const safeName = src.filename.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 60);
      exportData[`sources/${safeName}`] = content;
    } catch { /* skip */ }
  }

  return NextResponse.json(exportData);
}
