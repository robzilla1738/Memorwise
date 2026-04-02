import path from 'path';
import fs from 'fs';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const DATA_DIR = process.env.MEMORWISE_DATA_DIR || path.join(process.cwd(), '.openlm');

export function getDataDir() {
  return ensureDir(DATA_DIR);
}

export function getDbPath() {
  return path.join(getDataDir(), 'openlm.db');
}

export function getLanceDbPath() {
  return ensureDir(path.join(getDataDir(), 'lancedb'));
}

export function getSourcesPath() {
  return ensureDir(path.join(getDataDir(), 'sources'));
}

export function getNotebookSourcesPath(notebookId: string) {
  return ensureDir(path.join(getSourcesPath(), notebookId));
}
