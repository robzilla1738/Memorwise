'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FileText, Globe, Youtube, Image, Music, StickyNote, Lightbulb } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  pdf: <FileText size={14} className="text-red-400" />,
  url: <Globe size={14} className="text-green-400" />,
  youtube: <Youtube size={14} className="text-red-400" />,
  image: <Image size={14} className="text-orange-400" />,
  audio: <Music size={14} className="text-blue-400" />,
  file: <FileText size={14} className="text-foreground-muted" />,
  note: <StickyNote size={14} className="text-blue-400" />,
  concept: <Lightbulb size={14} className="text-purple-400" />,
};

const borderColorMap: Record<string, string> = {
  pdf: '#ef4444', url: '#22c55e', youtube: '#ef4444',
  image: '#f59e0b', audio: '#3b82f6', note: '#3b82f6',
  file: '#71717a', concept: '#8b5cf6',
};

type GraphNodeData = {
  label: string;
  nodeType: 'source' | 'note' | 'concept';
  sourceType?: string;
  summary?: string;
};

function GraphNodeComponent({ data }: NodeProps) {
  const d = data as unknown as GraphNodeData;
  const key = d.nodeType === 'concept' ? 'concept' : d.nodeType === 'note' ? 'note' : (d.sourceType || 'file');
  const icon = iconMap[key] || iconMap.file;
  const borderColor = borderColorMap[key] || '#71717a';
  const isConcept = d.nodeType === 'concept';

  return (
    <div
      className={`rounded-lg shadow-lg border border-border cursor-pointer transition-colors hover:border-foreground-muted ${
        isConcept ? 'bg-purple-500/5 px-3 py-2 min-w-[100px] max-w-[150px]' : 'bg-card px-3 py-2 min-w-[130px] max-w-[180px]'
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
      title={d.summary || (d.label as string)}
    >
      <Handle type="target" position={Position.Top} className="!bg-foreground-muted !w-2 !h-2 !border-0" />
      <div className="flex items-center gap-2">
        <span className="shrink-0">{icon}</span>
        <span className={`truncate leading-tight font-medium ${isConcept ? 'text-[11px] text-purple-300' : 'text-[12px] text-foreground'}`}>
          {d.label as string}
        </span>
      </div>
      {d.summary && !isConcept && (
        <p className="text-[10px] text-foreground-muted mt-1 line-clamp-2 leading-tight">
          {d.summary}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-foreground-muted !w-2 !h-2 !border-0" />
    </div>
  );
}

export default memo(GraphNodeComponent);
