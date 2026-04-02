import { NextResponse } from 'next/server';
import * as queries from '@/lib/db/queries';
import { getDb } from '@/lib/db/index';
import { registry } from '@/lib/llm/provider-registry';
import { getNotebookContext } from '@/lib/generate';

interface ConceptNode {
  id: string;
  type: 'source' | 'note' | 'concept';
  label: string;
  sourceType?: string;
  status?: string;
  summary?: string;
}

interface ConceptEdge {
  id: string;
  source: string;
  target: string;
  type: 'contains' | 'tag' | 'link';
}

// Cache extracted concepts per notebook to avoid re-extracting every time
const conceptCache = new Map<string, { concepts: ConceptNode[]; edges: ConceptEdge[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function extractConcepts(notebookId: string, sources: any[]): Promise<{ concepts: ConceptNode[]; edges: ConceptEdge[] }> {
  // Check cache
  const cached = conceptCache.get(notebookId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { concepts: cached.concepts, edges: cached.edges };
  }

  const concepts: ConceptNode[] = [];
  const edges: ConceptEdge[] = [];
  const conceptMap = new Map<string, string>(); // concept label -> concept id

  // Get context from all sources
  const context = getNotebookContext(notebookId, 6000);
  if (!context.trim()) return { concepts, edges };

  try {
    const provider = registry.getActiveProvider();
    if (!provider) return { concepts, edges };
    const model = registry.getActiveChatModel();

    // Extract concepts from ALL sources at once for better cross-referencing
    const sourceList = sources.map(s => s.filename).join(', ');
    const result = await provider.generate({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a knowledge graph builder. Extract key concepts, topics, people, and ideas from the provided documents. Return ONLY a JSON object with this exact format:
{
  "concepts": [
    { "name": "Concept Name", "sources": ["filename1", "filename2"] }
  ]
}

Rules:
- Extract 8-15 important concepts (key topics, people, ideas, themes)
- Each concept name should be 1-4 words
- List which source filenames discuss each concept
- Only include concepts that are substantively discussed, not just mentioned
- Return ONLY valid JSON, nothing else`
        },
        {
          role: 'user',
          content: `Extract key concepts from these documents (${sourceList}):\n\n${context}`
        },
      ],
      temperature: 0.3,
      maxTokens: 2048,
    });

    // Parse the LLM response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { concepts, edges };

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.concepts || !Array.isArray(parsed.concepts)) return { concepts, edges };

    // Build concept nodes and edges
    for (const c of parsed.concepts) {
      if (!c.name || !c.sources) continue;
      const conceptId = `concept-${c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      if (!conceptMap.has(c.name)) {
        conceptMap.set(c.name, conceptId);
        concepts.push({
          id: conceptId,
          type: 'concept',
          label: c.name,
        });
      }

      const cId = conceptMap.get(c.name)!;

      // Link concept to sources that mention it
      for (const srcName of c.sources) {
        const matchedSource = sources.find(s =>
          s.filename.toLowerCase().includes(srcName.toLowerCase()) ||
          srcName.toLowerCase().includes(s.filename.toLowerCase().replace(/\.[^.]+$/, ''))
        );
        if (matchedSource) {
          edges.push({
            id: `edge-${cId}-${matchedSource.id}`,
            source: cId,
            target: matchedSource.id,
            type: 'contains',
          });
        }
      }
    }
  } catch (err) {
    console.error('[graph] Concept extraction failed:', err);
  }

  // Cache results
  conceptCache.set(notebookId, { concepts, edges, timestamp: Date.now() });
  return { concepts, edges };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const notebookId = searchParams.get('notebookId');
  if (!notebookId) return NextResponse.json({ error: 'notebookId required' }, { status: 400 });

  const sources = queries.listSources(notebookId).filter(s => s.status === 'ready' || s.status === 'error');
  const notes = queries.listNotes(notebookId);
  const links = queries.getLinksForNotebook(notebookId);
  const tags = queries.listTags(notebookId);

  // Source and note nodes
  const nodes: ConceptNode[] = [
    ...sources.map(s => ({
      id: s.id, type: 'source' as const, label: s.filename,
      sourceType: s.source_type, status: s.status,
      summary: s.summary ? s.summary.slice(0, 120) + '...' : undefined,
    })),
    ...notes.map(n => ({
      id: n.id, type: 'note' as const, label: n.title || 'Untitled',
      summary: n.content ? n.content.slice(0, 120) + '...' : undefined,
    })),
  ];

  const edges: ConceptEdge[] = links.map(l => ({
    id: l.id, source: l.from_id, target: l.to_id, type: 'link' as const,
  }));

  // Tag-based edges
  for (const tag of tags) {
    const assignments = getDb().prepare('SELECT target_id FROM tag_assignments WHERE tag_id = ?').all(tag.id) as { target_id: string }[];
    for (let i = 0; i < assignments.length; i++) {
      for (let j = i + 1; j < assignments.length; j++) {
        edges.push({ id: `tag-${tag.id}-${i}-${j}`, source: assignments[i].target_id, target: assignments[j].target_id, type: 'tag' });
      }
    }
  }

  // Extract concepts using LLM
  if (sources.length > 0) {
    const { concepts, edges: conceptEdges } = await extractConcepts(notebookId, sources);
    nodes.push(...concepts);
    edges.push(...conceptEdges);
  }

  return NextResponse.json({ nodes, edges });
}
