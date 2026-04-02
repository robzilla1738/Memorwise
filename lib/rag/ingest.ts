import fs from 'fs';
import path from 'path';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { embedTexts } from './embeddings';
import { addChunks, type ChunkWithVector } from './vectorstore';
import { updateSourceStatus, updateSourceSummary } from '../db/queries';
import { ocrImage, parsePdfWithOcrFallback } from './ocr';
import { transcribeAudio, transcribeVideo } from './transcribe';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'webp'];
const AUDIO_EXTS = ['mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac', 'wma'];
const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv'];

// Simple processing queue — max 2 concurrent ingestions
const queue: (() => Promise<void>)[] = [];
let active = 0;
const MAX_CONCURRENT = 2;

function enqueue(fn: () => Promise<void>) {
  queue.push(fn);
  processQueue();
}

function processQueue() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    active++;
    job().finally(() => {
      active--;
      processQueue();
    });
  }
}

async function parseFile(filepath: string, filetype: string, sourceType: string): Promise<string> {
  const ext = filetype.toLowerCase();

  if (sourceType === 'url' || sourceType === 'youtube') {
    return fs.readFileSync(filepath, 'utf-8');
  }

  if (IMAGE_EXTS.includes(ext) || sourceType === 'image') {
    return ocrImage(filepath);
  }

  if (AUDIO_EXTS.includes(ext) || sourceType === 'audio') {
    return transcribeAudio(filepath);
  }

  if (VIDEO_EXTS.includes(ext) || sourceType === 'video') {
    return transcribeVideo(filepath);
  }

  if (ext === 'pdf') {
    return parsePdfWithOcrFallback(filepath);
  }

  if (['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods'].includes(ext)) {
    const officeparser = await import('officeparser');
    return await officeparser.parseOfficeAsync(filepath) as string;
  }

  if (['txt', 'md', 'markdown', 'csv', 'json', 'xml', 'html', 'htm', 'rtf'].includes(ext)) {
    return fs.readFileSync(filepath, 'utf-8');
  }

  return fs.readFileSync(filepath, 'utf-8');
}

async function doIngest(
  sourceId: string,
  notebookId: string,
  filepath: string,
  filetype: string,
  sourceType: string,
): Promise<void> {
  try {
    updateSourceStatus(sourceId, 'processing');
    console.log(`[ingest] Processing ${path.basename(filepath)} (${sourceType}/${filetype})...`);

    const text = await parseFile(filepath, filetype, sourceType);
    if (!text.trim()) throw new Error('No text content extracted. For images, OCR found no readable text.');

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const docs = await splitter.createDocuments([text]);
    const chunks = docs.map(d => d.pageContent);
    if (chunks.length === 0) throw new Error('No chunks generated');

    console.log(`[ingest] ${path.basename(filepath)}: ${chunks.length} chunks, embedding...`);

    let vectors: number[][];
    try {
      vectors = await embedTexts(chunks);
    } catch (err) {
      // embedTexts already provides detailed, actionable error messages
      throw err;
    }

    const filename = path.basename(filepath);
    const data: ChunkWithVector[] = chunks.map((chunk, i) => ({
      source_id: sourceId, chunk_index: i, text: chunk, vector: vectors[i],
      metadata: JSON.stringify({ filename, chunkIndex: i, sourceType }),
    }));
    await addChunks(notebookId, data);
    updateSourceStatus(sourceId, 'ready', chunks.length);
    console.log(`[ingest] ${filename}: ready (${chunks.length} chunks)`);

    // Generate source insight (best-effort, non-blocking)
    generateSourceInsight(sourceId, text.slice(0, 2000), filename).catch(() => {});

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] ${path.basename(filepath)} error:`, message);
    updateSourceStatus(sourceId, 'error', undefined, message);
  }
}

/** Auto-generate a brief insight/summary for a newly ingested source */
async function generateSourceInsight(sourceId: string, text: string, filename: string): Promise<void> {
  try {
    const { registry } = await import('../llm/provider-registry');
    const provider = registry.getActiveProvider();
    const model = registry.getActiveChatModel();

    const insight = await provider.generate({
      model,
      messages: [
        { role: 'system', content: 'Write a concise 2-3 sentence summary of this document. Focus on what it covers and its key points. No headings or markdown.' },
        { role: 'user', content: `Document "${filename}":\n\n${text}` },
      ],
      temperature: 0.3,
    });

    if (insight && insight.trim().length > 20) {
      updateSourceSummary(sourceId, insight.trim());
      console.log(`[ingest] Generated insight for ${filename}`);
    }
  } catch (err) {
    console.log(`[ingest] Insight generation skipped for ${filename}:`, err instanceof Error ? err.message : String(err));
  }
}

/** Queue a source for ingestion. Runs max 2 at a time. */
export function ingestSource(
  sourceId: string,
  notebookId: string,
  filepath: string,
  filetype: string,
  sourceType: string = 'file',
): void {
  enqueue(() => doIngest(sourceId, notebookId, filepath, filetype, sourceType));
}
