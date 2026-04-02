import type Database from 'better-sqlite3';

export function runMigrations(db: Database.Database) {
  // Core tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      embedding_model TEXT DEFAULT 'nomic-embed-text',
      embedding_dimension INTEGER DEFAULT 768,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filetype TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      chunk_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      source_type TEXT DEFAULT 'file',
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'New Chat',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'Untitled',
      content TEXT DEFAULT '',
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      UNIQUE(notebook_id, name)
    );

    CREATE TABLE IF NOT EXISTS tag_assignments (
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      PRIMARY KEY(tag_id, target_id)
    );

    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      from_id TEXT NOT NULL,
      from_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      to_type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(from_id, to_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS note_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed default note templates if empty
  const templateCount = db.prepare('SELECT COUNT(*) as c FROM note_templates').get() as { c: number };
  if (templateCount.c === 0) {
    const defaults = [
      { name: 'Research Paper', content: '# Paper Summary\n\n## Title\n\n## Authors\n\n## Abstract\n\n## Key Findings\n\n## Methodology\n\n## Conclusions\n' },
      { name: 'Meeting Notes', content: '# Meeting Notes\n\n## Date\n\n## Attendees\n\n## Agenda\n\n## Key Decisions\n\n## Action Items\n' },
      { name: 'Course Notes', content: '# Course Notes\n\n## Topic\n\n## Key Concepts\n\n## Examples\n\n## Questions\n\n## Summary\n' },
      { name: 'Book Analysis', content: '# Book Analysis\n\n## Title & Author\n\n## Main Themes\n\n## Key Arguments\n\n## My Takeaways\n\n## Rating\n' },
    ];
    const ins = db.prepare('INSERT INTO note_templates (id, name, content) VALUES (?, ?, ?)');
    for (const t of defaults) {
      ins.run(crypto.randomUUID(), t.name, t.content);
    }
  }

  // Add columns if upgrading from older schema
  try { db.exec('ALTER TABLE sources ADD COLUMN source_type TEXT DEFAULT \'file\''); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE sources ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE notes ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL'); } catch { /* already exists */ }
  try { db.exec('ALTER TABLE sources ADD COLUMN summary TEXT'); } catch { /* already exists */ }
}
