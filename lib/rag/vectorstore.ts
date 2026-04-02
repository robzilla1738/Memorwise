import * as lancedb from '@lancedb/lancedb';
import { getLanceDbPath } from '../paths';

export interface ChunkWithVector {
  [key: string]: unknown;
  source_id: string;
  chunk_index: number;
  text: string;
  vector: number[];
  metadata: string;
}

export interface SearchResult {
  source_id: string;
  chunk_index: number;
  text: string;
  metadata: string;
  _distance: number;
}

const globalForLance = globalThis as unknown as { __memorwise_lance?: lancedb.Connection };

async function getConnection(): Promise<lancedb.Connection> {
  if (!globalForLance.__memorwise_lance) {
    globalForLance.__memorwise_lance = await lancedb.connect(getLanceDbPath());
  }
  return globalForLance.__memorwise_lance;
}

function tableName(notebookId: string) {
  return `notebook_${notebookId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export async function addChunks(notebookId: string, chunks: ChunkWithVector[]): Promise<void> {
  if (chunks.length === 0) return;
  const conn = await getConnection();
  const name = tableName(notebookId);
  try { const table = await conn.openTable(name); await table.add(chunks); }
  catch { await conn.createTable(name, chunks); }
}

export async function search(notebookId: string, queryVector: number[], topK = 6, sourceId?: string): Promise<SearchResult[]> {
  const conn = await getConnection();
  try {
    const table = await conn.openTable(tableName(notebookId));
    let query = table.vectorSearch(queryVector).limit(sourceId ? topK * 3 : topK);
    const results = await query.toArray();
    let mapped = results.map((r: Record<string, unknown>) => ({
      source_id: r.source_id as string, chunk_index: r.chunk_index as number,
      text: r.text as string, metadata: r.metadata as string, _distance: r._distance as number,
    }));
    if (sourceId) {
      mapped = mapped.filter(r => r.source_id === sourceId).slice(0, topK);
    }
    return mapped;
  } catch { return []; }
}

/**
 * Get average embedding vector per source (centroid of all chunks).
 * Returns map of sourceId -> average vector.
 */
export async function getSourceCentroids(notebookId: string): Promise<Map<string, number[]>> {
  const conn = await getConnection();
  const name = tableName(notebookId);
  const centroids = new Map<string, number[]>();

  try {
    const table = await conn.openTable(name);
    const allRows = await table.query().limit(10000).toArray();

    // Group vectors by source_id — convert LanceDB Vector to plain array
    const grouped = new Map<string, number[][]>();
    for (const row of allRows) {
      const sid = row.source_id as string;
      const rawVec = row.vector;
      const vec = Array.from(rawVec as ArrayLike<number>);
      // Skip zero vectors (failed embeddings)
      if (vec.every(v => v === 0)) continue;
      if (!grouped.has(sid)) grouped.set(sid, []);
      grouped.get(sid)!.push(vec);
    }

    // Compute centroid per source
    for (const [sid, vecs] of grouped) {
      if (vecs.length === 0) continue;
      const dim = vecs[0].length;
      const centroid = new Array(dim).fill(0);
      for (const v of vecs) {
        for (let i = 0; i < dim; i++) centroid[i] += v[i];
      }
      for (let i = 0; i < dim; i++) centroid[i] /= vecs.length;
      centroids.set(sid, centroid);
    }
  } catch { /* table doesn't exist */ }

  return centroids;
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Find pairs of sources that are semantically similar (above threshold).
 */
export async function findSimilarSources(notebookId: string, threshold = 0.3): Promise<{ sourceA: string; sourceB: string; similarity: number }[]> {
  const centroids = await getSourceCentroids(notebookId);
  const sourceIds = Array.from(centroids.keys());
  const pairs: { sourceA: string; sourceB: string; similarity: number }[] = [];

  for (let i = 0; i < sourceIds.length; i++) {
    for (let j = i + 1; j < sourceIds.length; j++) {
      const sim = cosineSimilarity(centroids.get(sourceIds[i])!, centroids.get(sourceIds[j])!);
      // Always include the pair — UI can filter/dim low-similarity edges
      if (sim >= threshold) {
        pairs.push({ sourceA: sourceIds[i], sourceB: sourceIds[j], similarity: Math.max(0, sim) });
      }
    }
  }

  return pairs.sort((a, b) => b.similarity - a.similarity);
}

export async function deleteSourceChunks(notebookId: string, sourceId: string): Promise<void> {
  if (!/^[a-f0-9-]+$/i.test(sourceId)) return;
  const conn = await getConnection();
  try { const table = await conn.openTable(tableName(notebookId)); await table.delete(`source_id = '${sourceId}'`); } catch {}
}

export async function deleteNotebookTable(notebookId: string): Promise<void> {
  const conn = await getConnection();
  try { await conn.dropTable(tableName(notebookId)); } catch {}
}
