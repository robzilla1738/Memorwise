import { embedQuery } from './embeddings';
import { search } from './vectorstore';
import { getSource } from '../db/queries';
import type { Citation } from '../types';

export async function retrieveContext(notebookId: string, query: string, topK = 6, sourceId?: string): Promise<{ context: string; citations: Citation[] }> {
  const queryVector = await embedQuery(query);
  const results = await search(notebookId, queryVector, topK, sourceId);
  if (results.length === 0) return { context: '', citations: [] };

  const citations: Citation[] = [];
  const contextParts: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const source = getSource(r.source_id);
    const filename = source?.filename || 'Unknown';
    contextParts.push(`[${i + 1}] (${filename}):\n${r.text}`);
    citations.push({ source_id: r.source_id, filename, chunk_text: r.text, score: 1 - r._distance });
  }
  return { context: contextParts.join('\n\n'), citations };
}
