import { v4 as uuid } from 'uuid';
import { getDb } from './index';
import type { Notebook, Source, ChatSession, Message, Folder, Tag, TagAssignment, Link, Note } from '../types';

// --- Notebooks ---
export function listNotebooks(): Notebook[] {
  return getDb().prepare('SELECT * FROM notebooks ORDER BY updated_at DESC').all() as Notebook[];
}
export function createNotebook(name: string, description = ''): Notebook {
  const id = uuid();
  getDb().prepare('INSERT INTO notebooks (id, name, description) VALUES (?, ?, ?)').run(id, name, description);
  return getDb().prepare('SELECT * FROM notebooks WHERE id = ?').get(id) as Notebook;
}
export function updateNotebook(id: string, name: string, description: string): void {
  getDb().prepare("UPDATE notebooks SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?").run(name, description, id);
}
export function deleteNotebook(id: string): void {
  getDb().prepare('DELETE FROM notebooks WHERE id = ?').run(id);
}
export function getNotebook(id: string): Notebook | undefined {
  return getDb().prepare('SELECT * FROM notebooks WHERE id = ?').get(id) as Notebook | undefined;
}

// --- Sources ---
export function listSources(notebookId: string): Source[] {
  return getDb().prepare('SELECT * FROM sources WHERE notebook_id = ? ORDER BY created_at DESC').all(notebookId) as Source[];
}
export function createSource(notebookId: string, filename: string, filepath: string, filetype: string, fileSize: number, sourceType = 'file', folderId?: string): Source {
  const id = uuid();
  getDb().prepare('INSERT INTO sources (id, notebook_id, filename, filepath, filetype, file_size, source_type, folder_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, notebookId, filename, filepath, filetype, fileSize, sourceType, folderId ?? null);
  return getDb().prepare('SELECT * FROM sources WHERE id = ?').get(id) as Source;
}
export function updateSourceStatus(id: string, status: string, chunkCount?: number, errorMessage?: string): void {
  if (chunkCount !== undefined) {
    getDb().prepare('UPDATE sources SET status = ?, chunk_count = ?, error_message = ? WHERE id = ?').run(status, chunkCount, errorMessage ?? null, id);
  } else {
    getDb().prepare('UPDATE sources SET status = ?, error_message = ? WHERE id = ?').run(status, errorMessage ?? null, id);
  }
}
export function updateSourceFolder(id: string, folderId: string | null): void {
  getDb().prepare('UPDATE sources SET folder_id = ? WHERE id = ?').run(folderId, id);
}
export function deleteSource(id: string): void {
  getDb().prepare('DELETE FROM sources WHERE id = ?').run(id);
}
export function getSource(id: string): Source | undefined {
  return getDb().prepare('SELECT * FROM sources WHERE id = ?').get(id) as Source | undefined;
}
export function updateSourceSummary(id: string, summary: string): void {
  getDb().prepare('UPDATE sources SET summary = ? WHERE id = ?').run(summary, id);
}
export function getSourceChunks(sourceId: string): string[] {
  // Get all chunk texts from LanceDB via a simple query approach
  // We store chunks in the vectorstore, but for display we read from the original file
  const source = getSource(sourceId);
  if (!source) return [];
  try {
    const fs = require('fs');
    return [fs.readFileSync(source.filepath, 'utf-8')];
  } catch { return []; }
}

// --- Folders ---
export function listFolders(notebookId: string): Folder[] {
  return getDb().prepare('SELECT * FROM folders WHERE notebook_id = ? ORDER BY name ASC').all(notebookId) as Folder[];
}
export function createFolder(notebookId: string, name: string, parentId?: string): Folder {
  const id = uuid();
  getDb().prepare('INSERT INTO folders (id, notebook_id, parent_id, name) VALUES (?, ?, ?, ?)').run(id, notebookId, parentId ?? null, name);
  return getDb().prepare('SELECT * FROM folders WHERE id = ?').get(id) as Folder;
}
export function updateFolder(id: string, name?: string, parentId?: string | null): void {
  if (name !== undefined) getDb().prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, id);
  if (parentId !== undefined) getDb().prepare('UPDATE folders SET parent_id = ? WHERE id = ?').run(parentId, id);
}
export function deleteFolder(id: string): void {
  // Move children to root
  getDb().prepare('UPDATE sources SET folder_id = NULL WHERE folder_id = ?').run(id);
  getDb().prepare('UPDATE notes SET folder_id = NULL WHERE folder_id = ?').run(id);
  getDb().prepare('UPDATE folders SET parent_id = NULL WHERE parent_id = ?').run(id);
  getDb().prepare('DELETE FROM folders WHERE id = ?').run(id);
}

// --- Tags ---
export function listTags(notebookId: string): Tag[] {
  return getDb().prepare('SELECT * FROM tags WHERE notebook_id = ? ORDER BY name ASC').all(notebookId) as Tag[];
}
export function createTag(notebookId: string, name: string, color?: string): Tag {
  const id = uuid();
  getDb().prepare('INSERT INTO tags (id, notebook_id, name, color) VALUES (?, ?, ?, ?)').run(id, notebookId, name, color || '#6366f1');
  return getDb().prepare('SELECT * FROM tags WHERE id = ?').get(id) as Tag;
}
export function deleteTag(id: string): void {
  getDb().prepare('DELETE FROM tag_assignments WHERE tag_id = ?').run(id);
  getDb().prepare('DELETE FROM tags WHERE id = ?').run(id);
}
export function assignTag(tagId: string, targetId: string, targetType: string): void {
  getDb().prepare('INSERT OR IGNORE INTO tag_assignments (tag_id, target_id, target_type) VALUES (?, ?, ?)').run(tagId, targetId, targetType);
}
export function unassignTag(tagId: string, targetId: string): void {
  getDb().prepare('DELETE FROM tag_assignments WHERE tag_id = ? AND target_id = ?').run(tagId, targetId);
}
export function getTagsForTarget(targetId: string): Tag[] {
  return getDb().prepare('SELECT t.* FROM tags t JOIN tag_assignments ta ON t.id = ta.tag_id WHERE ta.target_id = ?').all(targetId) as Tag[];
}

// --- Links ---
export function createLink(notebookId: string, fromId: string, fromType: string, toId: string, toType: string): Link {
  const id = uuid();
  getDb().prepare('INSERT OR IGNORE INTO links (id, notebook_id, from_id, from_type, to_id, to_type) VALUES (?, ?, ?, ?, ?, ?)').run(id, notebookId, fromId, fromType, toId, toType);
  return getDb().prepare('SELECT * FROM links WHERE id = ?').get(id) as Link;
}
export function deleteLink(id: string): void {
  getDb().prepare('DELETE FROM links WHERE id = ?').run(id);
}
export function getLinksForNotebook(notebookId: string): Link[] {
  return getDb().prepare('SELECT * FROM links WHERE notebook_id = ?').all(notebookId) as Link[];
}
export function getBacklinks(targetId: string): Link[] {
  return getDb().prepare('SELECT * FROM links WHERE to_id = ? OR from_id = ?').all(targetId, targetId) as Link[];
}

// --- Notes ---
export function listNotes(notebookId: string): Note[] {
  return getDb().prepare('SELECT * FROM notes WHERE notebook_id = ? ORDER BY updated_at DESC').all(notebookId) as Note[];
}
export function createNote(notebookId: string, title = 'Untitled', content = '', folderId?: string): Note {
  const id = uuid();
  getDb().prepare('INSERT INTO notes (id, notebook_id, title, content, folder_id) VALUES (?, ?, ?, ?, ?)').run(id, notebookId, title, content, folderId ?? null);
  return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note;
}
export function updateNote(id: string, title?: string, content?: string, folderId?: string | null): void {
  if (title !== undefined) getDb().prepare("UPDATE notes SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
  if (content !== undefined) getDb().prepare("UPDATE notes SET content = ?, updated_at = datetime('now') WHERE id = ?").run(content, id);
  if (folderId !== undefined) getDb().prepare('UPDATE notes SET folder_id = ? WHERE id = ?').run(folderId, id);
}
export function deleteNote(id: string): void {
  getDb().prepare('DELETE FROM links WHERE from_id = ? OR to_id = ?').run(id, id);
  getDb().prepare('DELETE FROM tag_assignments WHERE target_id = ?').run(id);
  getDb().prepare('DELETE FROM notes WHERE id = ?').run(id);
}
export function getNote(id: string): Note | undefined {
  return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as Note | undefined;
}

// --- Chat Sessions ---
export function listChatSessions(notebookId: string): ChatSession[] {
  return getDb().prepare('SELECT * FROM chat_sessions WHERE notebook_id = ? ORDER BY updated_at DESC').all(notebookId) as ChatSession[];
}
export function createChatSession(notebookId: string, title = 'New Chat'): ChatSession {
  const id = uuid();
  getDb().prepare('INSERT INTO chat_sessions (id, notebook_id, title) VALUES (?, ?, ?)').run(id, notebookId, title);
  return getDb().prepare('SELECT * FROM chat_sessions WHERE id = ?').get(id) as ChatSession;
}
export function updateChatSessionTitle(id: string, title: string): void {
  getDb().prepare("UPDATE chat_sessions SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}
export function deleteChatSession(id: string): void {
  getDb().prepare('DELETE FROM messages WHERE session_id = ?').run(id);
  getDb().prepare('DELETE FROM chat_sessions WHERE id = ?').run(id);
}

// --- Messages ---
export function getMessages(sessionId: string): Message[] {
  const rows = getDb().prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId) as (Message & { citations: string | null })[];
  return rows.map(row => ({ ...row, citations: row.citations ? JSON.parse(row.citations) : null }));
}
export function saveMessage(sessionId: string, role: string, content: string, citations?: unknown[]): Message {
  const id = uuid();
  const citationsJson = citations ? JSON.stringify(citations) : null;
  getDb().prepare('INSERT INTO messages (id, session_id, role, content, citations) VALUES (?, ?, ?, ?, ?)').run(id, sessionId, role, content, citationsJson);
  getDb().prepare("UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?").run(sessionId);
  return { id, session_id: sessionId, role: role as Message['role'], content, citations: citations as Message['citations'] ?? null, created_at: new Date().toISOString() };
}

// --- Generations (persisted studio output) ---
export function listGenerations(notebookId: string, type?: string): { id: string; notebook_id: string; type: string; title: string; content: string; created_at: string }[] {
  if (type) return getDb().prepare('SELECT * FROM generations WHERE notebook_id = ? AND type = ? ORDER BY created_at DESC').all(notebookId, type) as any[];
  return getDb().prepare('SELECT * FROM generations WHERE notebook_id = ? ORDER BY created_at DESC').all(notebookId) as any[];
}
export function saveGeneration(notebookId: string, type: string, title: string, content: string): { id: string; type: string; title: string; content: string; created_at: string } {
  const id = uuid();
  getDb().prepare('INSERT INTO generations (id, notebook_id, type, title, content) VALUES (?, ?, ?, ?, ?)').run(id, notebookId, type, title, content);
  return { id, type, title, content, created_at: new Date().toISOString() };
}
export function deleteGeneration(id: string): void {
  getDb().prepare('DELETE FROM generations WHERE id = ?').run(id);
}

// --- Note Templates ---
export function listNoteTemplates(): { id: string; name: string; content: string; created_at: string }[] {
  return getDb().prepare('SELECT * FROM note_templates ORDER BY name').all() as any[];
}
export function createNoteTemplate(name: string, content: string): { id: string; name: string; content: string } {
  const id = uuid();
  getDb().prepare('INSERT INTO note_templates (id, name, content) VALUES (?, ?, ?)').run(id, name, content);
  return { id, name, content };
}
export function deleteNoteTemplate(id: string): void {
  getDb().prepare('DELETE FROM note_templates WHERE id = ?').run(id);
}

// --- Settings ---
export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function setSetting(key: string, value: string): void {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

// --- Graph Data ---
// Note: getGraphData is now async because it uses vector similarity
export async function getGraphData(notebookId: string) {
  const { findSimilarSources } = await import('../rag/vectorstore');

  const sources = listSources(notebookId);
  const notes = listNotes(notebookId);
  const links = getLinksForNotebook(notebookId);
  const tags = listTags(notebookId);

  const nodes = [
    ...sources.map(s => ({
      id: s.id, type: 'source' as const, label: s.filename,
      sourceType: s.source_type, status: s.status,
      summary: s.summary ? s.summary.slice(0, 80) + '...' : undefined,
    })),
    ...notes.map(n => ({
      id: n.id, type: 'note' as const, label: n.title,
      summary: n.content ? n.content.slice(0, 80) + '...' : undefined,
    })),
  ];

  const edges: { id: string; source: string; target: string; type: string; similarity?: number }[] =
    links.map(l => ({ id: l.id, source: l.from_id, target: l.to_id, type: 'link' }));

  // Add tag-based edges
  for (const tag of tags) {
    const assignments = getDb().prepare('SELECT target_id FROM tag_assignments WHERE tag_id = ?').all(tag.id) as { target_id: string }[];
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        edges.push({ id: `tag-${tag.id}-${i}-${j}`, source: assignments[i].target_id, target: assignments[j].target_id, type: 'tag' });
      }
    }
  }

  // Add embedding-similarity edges (auto-discovered relationships)
  try {
    const similarPairs = await findSimilarSources(notebookId, 0.3);
    console.log(`[graph] Found ${similarPairs.length} similar source pairs`, similarPairs.map(p => `${p.similarity.toFixed(2)}`));
    for (const pair of similarPairs) {
      // Don't duplicate if a manual link already exists
      const exists = edges.some(e =>
        (e.source === pair.sourceA && e.target === pair.sourceB) ||
        (e.source === pair.sourceB && e.target === pair.sourceA)
      );
      if (!exists) {
        edges.push({
          id: `sim-${pair.sourceA}-${pair.sourceB}`,
          source: pair.sourceA,
          target: pair.sourceB,
          type: 'similarity',
          similarity: pair.similarity,
        });
      }
    }
  } catch (err) {
    console.error('[graph] similarity computation failed:', err);
  }

  return { nodes, edges };
}
