import Database from 'better-sqlite3';
import { getDbPath } from '../paths';
import { runMigrations } from './migrations';

// Store DB on globalThis to survive Next.js HMR in dev mode
const globalForDb = globalThis as unknown as { __memorwise_db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__memorwise_db) {
    const db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
    globalForDb.__memorwise_db = db;
  }
  return globalForDb.__memorwise_db;
}
