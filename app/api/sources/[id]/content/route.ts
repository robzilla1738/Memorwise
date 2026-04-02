import { NextResponse } from 'next/server';
import fs from 'fs';
import * as queries from '@/lib/db/queries';

const BINARY_TYPES = ['image', 'audio', 'video'];
const BINARY_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'mkv', 'avi', 'mov', 'webm'];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = queries.getSource(id);
  if (!source) return NextResponse.json({ error: 'Source not found' }, { status: 404 });

  let content = '';
  const isBinary = BINARY_TYPES.includes(source.source_type) || BINARY_EXTS.includes(source.filetype);

  if (isBinary) {
    // For binary sources (images, audio, video), show the extracted text from vector chunks
    // The chunks contain the OCR/transcription text
    try {
      const { getDb } = await import('@/lib/db/index');
      const db = getDb();
      // Get chunk texts from messages or from the vector store
      // The extracted text was stored during ingestion — check if we can get it from vectorstore
      const lancedb = await import('@lancedb/lancedb');
      const { getLanceDbPath } = await import('@/lib/paths');
      const conn = await lancedb.connect(getLanceDbPath());
      const tableName = `notebook_${source.notebook_id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      try {
        const table = await conn.openTable(tableName);
        const chunks = await table.query()
          .where(`source_id = '${id.replace(/[^a-f0-9-]/gi, '')}'`)
          .limit(100)
          .toArray();
        if (chunks.length > 0) {
          content = chunks
            .sort((a: any, b: any) => (a.chunk_index as number) - (b.chunk_index as number))
            .map((c: any) => c.text as string)
            .join('\n\n');
        } else {
          content = '(This source has not been indexed yet, or OCR/transcription found no text. Try clicking Re-index.)';
        }
      } catch {
        content = '(Could not read extracted text. Source may need re-indexing.)';
      }
    } catch {
      content = '(Binary file — extracted text not available)';
    }
  } else {
    // Text-based source — read the file directly
    try {
      content = fs.readFileSync(source.filepath, 'utf-8');
    } catch {
      content = '(Unable to read source file)';
    }
  }

  return NextResponse.json({
    ...source,
    content: content.slice(0, 50000),
  });
}
