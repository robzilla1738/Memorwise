import { registry } from './llm/provider-registry';
import * as queries from './db/queries';
import fs from 'fs';

/** Generate text using the active LLM (non-streaming) */
async function generate(prompt: string, systemPrompt?: string): Promise<string> {
  const provider = registry.getActiveProvider();
  const model = registry.getActiveChatModel();
  const messages = [
    ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
    { role: 'user' as const, content: prompt },
  ];
  return provider.generate({ model, messages });
}

const BINARY_SOURCE_TYPES = ['image', 'audio', 'video'];
const BINARY_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'mp3', 'wav', 'flac', 'ogg', 'm4a', 'mp4', 'mkv', 'avi', 'mov', 'webm'];

function isReadableText(text: string): boolean {
  if (!text || text.length < 20) return false;
  // Check if text has too many non-printable or garbled characters
  const printable = text.replace(/[^\x20-\x7E\n\r\t]/g, '');
  return printable.length / text.length > 0.7; // At least 70% readable ASCII
}

/** Get combined text from all ready sources — uses summaries when available, skips binary garbage */
export function getNotebookContext(notebookId: string, maxChars = 3000): string {
  // Include 'ready' and 'error' sources — error means embedding failed but text may still be readable
  const sources = queries.listSources(notebookId).filter(s => s.status === 'ready' || s.status === 'error');
  let combined = '';
  for (const src of sources) {
    let text = '';

    // 1. Always prefer summary (clean LLM-generated text)
    if (src.summary) {
      text = src.summary;
    }
    // 2. For binary sources (images, audio, video), skip raw file — only use summary or chunks
    else if (BINARY_SOURCE_TYPES.includes(src.source_type) || BINARY_EXTS.includes(src.filetype)) {
      continue; // Skip — no summary available and raw file is binary
    }
    // 3. For text sources, read the file
    else {
      try { text = fs.readFileSync(src.filepath, 'utf-8'); } catch { continue; }
      if (!isReadableText(text)) continue; // Skip garbled/binary content
    }

    if (!text.trim()) continue;

    const header = `\n--- ${src.filename} ---\n`;
    if (combined.length + header.length + text.length > maxChars) {
      const remaining = maxChars - combined.length - header.length;
      if (remaining > 100) combined += header + text.slice(0, remaining) + '...';
      break;
    }
    combined += header + text;
  }
  return combined;
}

/** Generate suggested questions for a notebook */
export async function generateSuggestions(notebookId: string): Promise<string[]> {
  const context = getNotebookContext(notebookId, 2000);
  if (!context.trim()) return [];

  const result = await generate(
    `Based on these documents, suggest 5 short questions a user might ask. Each question must be under 10 words. Return ONLY a JSON array of strings.\n\n${context}`,
    'Return a JSON array of 5 short question strings. Each under 10 words. No markdown, no explanations.'
  );

  try {
    const match = result.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]).slice(0, 5);
  } catch {}
  return result.split('\n').filter(l => l.trim().length > 10).slice(0, 5).map(l => l.replace(/^\d+[\.\)]\s*/, '').replace(/^["']|["']$/g, ''));
}

/** Generate a summary for a single source */
export async function generateSourceSummary(sourceId: string): Promise<string> {
  const source = queries.getSource(sourceId);
  if (!source) throw new Error('Source not found');

  let text: string;
  try { text = fs.readFileSync(source.filepath, 'utf-8'); } catch { throw new Error('Cannot read source file'); }

  // Keep it short for local models
  const truncated = text.slice(0, 2500);
  const result = await generate(
    `Summarize this document concisely:\n\n${truncated}`,
    'Write a concise summary in 2-3 paragraphs.'
  );

  queries.updateSourceSummary(sourceId, result);
  return result;
}

/** Generate a study guide from all sources in a notebook */
export async function generateStudyGuide(notebookId: string): Promise<string> {
  const context = getNotebookContext(notebookId, 2500);
  if (!context.trim()) throw new Error('No sources to generate from');

  return generate(
    `Create a study guide from these documents. Include key concepts, definitions, topics, and review questions. Use markdown.\n\n${context}`,
    'Create a well-organized study guide in markdown.'
  );
}

/** Generate a concise summary of all sources in a notebook */
export async function generateNotebookSummary(notebookId: string): Promise<string> {
  const context = getNotebookContext(notebookId, 2500);
  if (!context.trim()) throw new Error('No sources to generate from');

  return generate(
    `Summarize the following documents concisely. Cover the main topics, key points, and important details. Use markdown.\n\n${context}`,
    'Write a clear, concise summary in 2-4 paragraphs with markdown formatting.'
  );
}

/** Generate flashcards from all sources in a notebook */
export async function generateFlashcards(notebookId: string): Promise<{ front: string; back: string }[]> {
  const context = getNotebookContext(notebookId, 2000);
  if (!context.trim()) throw new Error('No sources to generate from');

  const result = await generate(
    `Create 10 flashcards from these documents. Return ONLY a JSON array with "front" and "back" fields.\n\n${context}`,
    'Return only a JSON array of flashcard objects with "front" and "back" string fields. No other text.'
  );

  try {
    const match = result.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]).slice(0, 15);
  } catch {}
  throw new Error('Failed to parse flashcards. Try again or use a different model.');
}
