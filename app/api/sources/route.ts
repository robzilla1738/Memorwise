import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import * as queries from '@/lib/db/queries';
import { getNotebookSourcesPath } from '@/lib/paths';
import { ingestSource } from '@/lib/rag/ingest';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'ogg', 'm4a'];
const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'webm'];

function detectSourceType(ext: string): string {
  if (IMAGE_EXTS.includes(ext)) return 'image';
  if (AUDIO_EXTS.includes(ext)) return 'audio';
  if (VIDEO_EXTS.includes(ext)) return 'video';
  return 'file';
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });
  return NextResponse.json(queries.listSources(notebookId));
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const notebookId = formData.get('notebookId') as string;
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  const folderId = formData.get('folderId') as string | null;
  const files = formData.getAll('files') as File[];
  if (files.length === 0) return NextResponse.json({ error: 'No files' }, { status: 400 });

  const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  const sources = [];
  for (const file of files) {
    try {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File "${file.name}" exceeds 500MB limit` }, { status: 413 });
      }
      const ext = path.extname(file.name).slice(1).toLowerCase();
      const sourceType = detectSourceType(ext);
      const buffer = Buffer.from(await file.arrayBuffer());
      const destDir = getNotebookSourcesPath(notebookId);
      const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const destPath = path.join(destDir, `${Date.now()}_${safeName}`);
      fs.writeFileSync(destPath, buffer);

      const source = queries.createSource(notebookId, file.name, destPath, ext, file.size, sourceType, folderId ?? undefined);
      sources.push(source);

      // Async ingestion — don't await
      ingestSource(source.id, notebookId, destPath, ext, sourceType);
    } catch (err) {
      console.error(`Failed to process ${file.name}:`, err);
    }
  }

  return NextResponse.json(sources);
}
