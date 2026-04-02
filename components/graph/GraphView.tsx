'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import GraphNodeComponent from '@/components/graph/GraphNode';
import { Loader2, X } from 'lucide-react';

interface RawNode {
  id: string;
  type: 'source' | 'note' | 'concept';
  label: string;
  sourceType?: string;
  status?: string;
  summary?: string;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

const nodeTypes = { custom: GraphNodeComponent };

function layoutNodes(rawNodes: RawNode[]): Node[] {
  const concepts = rawNodes.filter(n => n.type === 'concept');
  const sources = rawNodes.filter(n => n.type === 'source');
  const notes = rawNodes.filter(n => n.type === 'note');

  const nodes: Node[] = [];

  // Place concepts in center ring
  const conceptRadius = Math.max(150, concepts.length * 25);
  concepts.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(concepts.length, 1);
    nodes.push({
      id: n.id, type: 'custom',
      position: { x: Math.cos(angle) * conceptRadius + 500, y: Math.sin(angle) * conceptRadius + 400 },
      data: { label: n.label, nodeType: 'concept', sourceType: '', summary: '' },
    });
  });

  // Place sources in outer ring
  const sourceRadius = conceptRadius + 180;
  sources.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(sources.length, 1) + 0.3;
    nodes.push({
      id: n.id, type: 'custom',
      position: { x: Math.cos(angle) * sourceRadius + 500, y: Math.sin(angle) * sourceRadius + 400 },
      data: { label: n.label, nodeType: 'source', sourceType: n.sourceType || 'file', summary: n.summary || '' },
    });
  });

  // Place notes further out
  const noteRadius = sourceRadius + 150;
  notes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(notes.length, 1) + 0.6;
    nodes.push({
      id: n.id, type: 'custom',
      position: { x: Math.cos(angle) * noteRadius + 500, y: Math.sin(angle) * noteRadius + 400 },
      data: { label: n.label, nodeType: 'note', sourceType: '', summary: n.summary || '' },
    });
  });

  return nodes;
}

function convertEdges(rawEdges: RawEdge[]): Edge[] {
  return rawEdges.map(e => {
    const isContains = e.type === 'contains';
    const isTag = e.type === 'tag';
    return {
      id: e.id, source: e.source, target: e.target,
      style: {
        stroke: isContains ? '#8b5cf6' : isTag ? '#3b82f6' : '#71717a',
        strokeWidth: isContains ? 2 : 1.5,
        strokeDasharray: isTag ? '5 5' : undefined,
        opacity: 0.6,
      },
    };
  });
}

function useIsDark() {
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

export function GraphView({ notebookId }: { notebookId: string }) {
  const isDark = useIsDark();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([] as Node[]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);
  const [loading, setLoading] = useState(true);
  const [rawNodes, setRawNodes] = useState<RawNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<RawNode | null>(null);
  const [connectedItems, setConnectedItems] = useState<RawNode[]>([]);
  const [conceptInsight, setConceptInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [showSources, setShowSources] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [showConcepts, setShowConcepts] = useState(true);

  useEffect(() => {
    async function fetchGraph() {
      setLoading(true);
      try {
        const res = await fetch(`/api/graph?notebookId=${notebookId}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setRawNodes(data.nodes || []);
        setRawEdges(data.edges || []);
      } catch (err) {
        console.error('Graph fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchGraph();
  }, [notebookId]);

  useEffect(() => {
    const filtered = rawNodes.filter(n => {
      if (n.type === 'source' && !showSources) return false;
      if (n.type === 'note' && !showNotes) return false;
      if (n.type === 'concept' && !showConcepts) return false;
      return true;
    });
    const visibleIds = new Set(filtered.map(n => n.id));
    const filteredEdges = rawEdges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));
    setNodes(layoutNodes(filtered));
    setEdges(convertEdges(filteredEdges));
  }, [rawNodes, rawEdges, showSources, showNotes, showConcepts, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: any, node: Node) => {
    const raw = rawNodes.find(n => n.id === node.id);
    if (!raw) return;
    setSelectedNode(raw);
    setConceptInsight('');
    setLoadingInsight(false);
    // Find connected nodes
    const connectedIds = new Set<string>();
    for (const e of rawEdges) {
      if (e.source === node.id) connectedIds.add(e.target);
      if (e.target === node.id) connectedIds.add(e.source);
    }
    setConnectedItems(rawNodes.filter(n => connectedIds.has(n.id)));
  }, [rawNodes, rawEdges]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 size={16} className="animate-spin" />
          Building knowledge graph...
        </div>
      </div>
    );
  }

  const conceptCount = rawNodes.filter(n => n.type === 'concept').length;
  const sourceCount = rawNodes.filter(n => n.type === 'source').length;

  return (
    <div className="flex-1 flex flex-col bg-surface overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border">
        <span className="text-xs font-medium text-foreground-muted uppercase tracking-wider">Filter</span>
        {[
          { key: 'concepts', label: `Concepts (${conceptCount})`, checked: showConcepts, set: setShowConcepts },
          { key: 'sources', label: `Sources (${sourceCount})`, checked: showSources, set: setShowSources },
          { key: 'notes', label: 'Notes', checked: showNotes, set: setShowNotes },
        ].map(f => (
          <label key={f.key} className="flex items-center gap-1.5 text-xs text-foreground-secondary cursor-pointer">
            <input type="checkbox" checked={f.checked} onChange={e => f.set(e.target.checked)} className="rounded border-border" />
            {f.label}
          </label>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Graph */}
        <div className="flex-1 relative" style={{ background: isDark ? '#09090b' : '#ffffff' }}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes} fitView
            colorMode={isDark ? 'dark' : 'light'}
            proOptions={{ hideAttribution: true }}
            style={{ background: 'transparent' }}>
            <Background color={isDark ? '#27272a' : '#d4d4d8'} gap={20} size={1} />
            <Controls />
          </ReactFlow>

          {/* Legend */}
          <div className="absolute bottom-3 left-14 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-[10px] space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500/30 border border-purple-500/50" />
              <span className="text-foreground-muted">Concept</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-[2px] bg-purple-500/60 rounded" />
              <span className="text-foreground-muted">Source → Concept</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-[2px] rounded" style={{ background: 'repeating-linear-gradient(90deg, #3b82f6 0px, #3b82f6 4px, transparent 4px, transparent 8px)' }} />
              <span className="text-foreground-muted">Shared tag</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selectedNode && (
          <div className="w-[260px] min-w-[260px] border-l border-border bg-card overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                selectedNode.type === 'concept' ? 'bg-purple-500/10 text-purple-400' :
                selectedNode.type === 'source' ? 'bg-red-500/10 text-red-400' :
                'bg-blue-500/10 text-blue-400'
              }`}>
                {selectedNode.type}
              </span>
              <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-elevated text-foreground-muted">
                <X size={14} />
              </button>
            </div>
            <h3 className="text-sm font-medium text-foreground mb-2">{selectedNode.label}</h3>
            {selectedNode.summary && (
              <p className="text-[12px] text-foreground-secondary mb-3 leading-relaxed">{selectedNode.summary}</p>
            )}
            {connectedItems.length > 0 && (
              <div>
                <p className="text-[11px] text-foreground-muted uppercase tracking-wider mb-2">
                  Connected ({connectedItems.length})
                </p>
                <div className="space-y-1">
                  {connectedItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 bg-elevated rounded-lg text-[12px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        item.type === 'concept' ? 'bg-purple-400' :
                        item.type === 'source' ? 'bg-red-400' : 'bg-blue-400'
                      }`} />
                      <span className="text-foreground-secondary truncate">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explore concept — ask LLM what sources say */}
            {selectedNode.type === 'concept' && (
              <div className="mt-3">
                {!conceptInsight && !loadingInsight && (
                  <button
                    onClick={async () => {
                      setLoadingInsight(true);
                      try {
                        const res = await fetch('/api/graph/explore', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ notebookId, concept: selectedNode.label }),
                        });
                        const reader = res.body!.getReader();
                        const decoder = new TextDecoder();
                        let buffer = '', fullText = '';
                        while (true) {
                          const { done, value } = await reader.read();
                          if (done) break;
                          buffer += decoder.decode(value, { stream: true });
                          const lines = buffer.split('\n');
                          buffer = lines.pop() || '';
                          for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                              const event = JSON.parse(line);
                              if (event.type === 'token') { fullText += event.content; setConceptInsight(fullText); }
                              else if (event.type === 'done') { setConceptInsight(event.fullText); }
                            } catch {}
                          }
                        }
                      } catch { setConceptInsight('Failed to load insight.'); }
                      setLoadingInsight(false);
                    }}
                    className="w-full px-3 py-2 text-[12px] font-medium bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg transition-colors">
                    What do sources say about this?
                  </button>
                )}
                {loadingInsight && (
                  <div className="flex items-center gap-2 text-[11px] text-foreground-muted py-2">
                    <Loader2 size={12} className="animate-spin" /> Analyzing sources...
                  </div>
                )}
                {conceptInsight && (
                  <div className="mt-2 p-3 bg-elevated rounded-lg">
                    <p className="text-[10px] text-foreground-muted uppercase tracking-wider mb-1.5">From your documents</p>
                    <div className="text-[12px] text-foreground-secondary leading-relaxed whitespace-pre-wrap">
                      {conceptInsight}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
