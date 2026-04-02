'use client';

import { useState, useEffect } from 'react';
import { X, FileText, Loader2, Sparkles, Globe, Youtube, Image, Music, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Source } from '@/lib/types';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { toast } from '@/components/ui/Toast';

function sourceIcon(sourceType: string) {
  switch (sourceType) {
    case 'url': return <Globe size={16} className="text-green-400" />;
    case 'youtube': return <Youtube size={16} className="text-red-400" />;
    case 'image': return <Image size={16} className="text-orange-400" />;
    case 'audio': return <Music size={16} className="text-blue-400" />;
    default: return <FileText size={16} className="text-red-400" />;
  }
}

export function SourceViewer({ source, onClose }: { source: Source; onClose: () => void }) {
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState(source.summary || '');
  const [loading, setLoading] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sources/${source.id}/content`);
        if (res.ok) {
          const data = await res.json();
          setContent(data.content || '');
          if (data.summary) setSummary(data.summary);
        }
      } catch {
        toast('error', 'Failed to load source content');
      }
      setLoading(false);
    }
    load();
  }, [source.id]);

  const handleGenerateSummary = async () => {
    setSummarizing(true);
    try {
      const res = await fetch('/api/generate/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        toast('success', 'Summary generated');
      } else {
        const data = await res.json().catch(() => ({}));
        toast('error', data.error || 'Failed to generate summary');
      }
    } catch {
      toast('error', 'Failed to generate summary');
    }
    setSummarizing(false);
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/sources/reindex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id }),
      });
      if (res.ok) {
        toast('success', 'Source re-indexed');
      } else {
        toast('error', 'Re-indexing failed');
      }
    } catch {
      toast('error', 'Re-indexing failed');
    }
    setReindexing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 flex flex-col bg-background border-l border-border overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {sourceIcon(source.source_type)}
            <span className="text-sm font-medium text-foreground truncate">{source.filename}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-elevated text-foreground-muted hover:text-foreground-secondary shrink-0" aria-label="Close" title="Close (Esc)">
            <X size={15} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground-muted bg-elevated px-2.5 py-0.5 rounded-md">
            {source.source_type}
          </span>
          <span className="text-[11px] text-foreground-muted bg-elevated px-2.5 py-0.5 rounded-md">
            {source.chunk_count} chunks
          </span>
          <button onClick={handleReindex} disabled={reindexing} title="Re-index: re-chunk and re-embed this source"
            className="flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] text-foreground-muted hover:text-foreground-secondary border border-border hover:border-border-subtle rounded-md disabled:opacity-50">
            <RefreshCw size={12} className={reindexing ? 'animate-spin' : ''} />
            {reindexing ? 'Re-indexing...' : 'Re-index'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary section */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-widest">Summary</span>
            {!summary && (
              <button onClick={handleGenerateSummary} disabled={summarizing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-accent-blue hover:text-accent-blue-hover bg-accent-blue/5 hover:bg-accent-blue/10 rounded-md">
                {summarizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {summarizing ? 'Generating...' : 'Generate'}
              </button>
            )}
          </div>
          {summary ? (
            <div className="text-sm text-foreground-secondary leading-relaxed">
              <MarkdownRenderer content={summary} />
            </div>
          ) : (
            <p className="text-[13px] text-foreground-muted italic">No summary yet. Click Generate to create an AI summary of this source.</p>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-widest block mb-2">Extracted Text</span>
          {loading ? (
            <div className="flex items-center gap-2 text-foreground-muted text-sm py-8">
              <Loader2 size={16} className="animate-spin" /> Loading content...
            </div>
          ) : content ? (
            <pre className="text-[13px] text-foreground-secondary leading-relaxed whitespace-pre-wrap font-sans max-h-[60vh] overflow-y-auto">
              {content}
            </pre>
          ) : (
            <p className="text-[13px] text-foreground-muted italic">
              No text content extracted. This may be a binary file (image/audio/video) — check the summary above for AI-extracted information.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
