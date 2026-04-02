'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Layers,
  StickyNote,
  RefreshCw,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Headphones,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { AudioOverview } from '@/components/audio/AudioOverview';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';

interface StudioPanelProps {
  notebookId: string;
  onViewChange: (view: string) => void;
}

interface Generation {
  id: string;
  type: string;
  title: string;
  content: string;
  created_at: string;
}

const tools = [
  { id: 'study-guide', label: 'Study Guide', icon: BookOpen },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'quiz', label: 'Quiz', icon: BookOpen },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'summary', label: 'Summary', icon: RefreshCw },
  { id: 'audio-overview', label: 'Audio', icon: Headphones },
];

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 280;

export function StudioPanel({ notebookId, onViewChange }: StudioPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAudioOverview, setShowAudioOverview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [viewingGen, setViewingGen] = useState<Generation | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);

  // Load saved generations on mount and when notebook changes
  useEffect(() => {
    if (!notebookId) return;
    fetch(`/api/generations?notebookId=${notebookId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setGenerations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [notebookId]);

  const saveGeneration = async (type: string, title: string, content: string) => {
    try {
      const res = await fetch('/api/generations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, type, title, content }),
      });
      if (res.ok) {
        const gen = await res.json();
        setGenerations(prev => [gen, ...prev]);
        return gen;
      }
    } catch { /* ignore */ }
  };

  const deleteGeneration = async (id: string) => {
    const ok = await confirm({ title: 'Delete generation', message: 'This will permanently delete this saved output.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    try {
      await fetch(`/api/generations?id=${id}`, { method: 'DELETE' });
      setGenerations(prev => prev.filter(g => g.id !== id));
      if (viewingGen?.id === id) setViewingGen(null);
      toast('success', 'Deleted');
    } catch { toast('error', 'Failed to delete'); }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
  }, [width]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartX.current - e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta)));
    };
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  const handleToolClick = async (toolId: string) => {
    setError(null);
    setViewingGen(null);

    if (toolId === 'notes') {
      onViewChange('notes');
      return;
    }

    if (toolId === 'audio-overview') {
      setShowAudioOverview(true);
      return;
    }

    setShowAudioOverview(false);

    if (toolId === 'flashcards') {
      setGenerating('flashcards');
      try {
        const res = await fetch('/api/generate/flashcards', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notebookId }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to generate flashcards'); }
        const cards = await res.json();
        await saveGeneration('flashcards', `Flashcards (${cards.length} cards)`, JSON.stringify(cards));
        toast('success', `${cards.length} flashcards generated & saved`);
        onViewChange('flashcards');
      } catch (err: any) { setError(err.message); toast('error', err.message || 'Failed'); }
      finally { setGenerating(null); }
      return;
    }

    if (toolId === 'quiz') {
      setGenerating('quiz');
      try {
        const res = await fetch('/api/generate/quiz', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notebookId }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed to generate quiz'); }
        const questions = await res.json();
        await saveGeneration('quiz', `Quiz (${questions.length} questions)`, JSON.stringify(questions));
        toast('success', `${questions.length} quiz questions generated & saved`);
        onViewChange('quiz');
      } catch (err: any) { setError(err.message); toast('error', err.message || 'Failed'); }
      finally { setGenerating(null); }
      return;
    }

    if (toolId === 'study-guide') {
      setGenerating('study-guide');
      try {
        const res = await fetch('/api/generate/study-guide', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notebookId }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
        const data = await res.json();
        const title = data.title || 'Study Guide';
        const content = data.content || '';
        await saveGeneration('study-guide', title, content);
        toast('success', 'Study guide generated & saved');
      } catch (err: any) { setError(err.message); toast('error', err.message || 'Failed'); }
      finally { setGenerating(null); }
    }

    if (toolId === 'summary') {
      setGenerating('summary');
      try {
        const res = await fetch('/api/generate/summary', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notebookId }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
        const data = await res.json();
        const content = data.summary || '';
        await saveGeneration('summary', 'Summary', content);
        toast('success', 'Summary generated & saved');
      } catch (err: any) { setError(err.message); toast('error', err.message || 'Failed'); }
      finally { setGenerating(null); }
    }
  };

  if (collapsed) {
    return (
      <div className="w-10 min-w-10 h-full flex flex-col items-center pt-3 bg-card rounded-xl border border-border">
        <button onClick={() => setCollapsed(false)}
          className="p-1.5 rounded-md hover:bg-elevated text-foreground-muted hover:text-foreground-secondary transition-colors" title="Expand Studio">
          <PanelRightOpen size={16} />
        </button>
      </div>
    );
  }

  const typeLabels: Record<string, string> = { 'study-guide': 'Study Guide', summary: 'Summary', audio: 'Audio', flashcards: 'Flashcards', quiz: 'Quiz' };

  return (
    <div className="relative h-full" style={{ width: `${width}px`, minWidth: `${width}px` }}>
      <div onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 w-[8px] h-full cursor-col-resize z-20 group -translate-x-1/2" title="Drag to resize">
        <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-10 rounded-full transition-colors ${isDragging ? 'bg-accent-blue' : 'bg-transparent group-hover:bg-foreground-muted/40'}`} />
      </div>

      <div className="h-full bg-card rounded-xl flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm font-medium text-foreground">Studio</span>
          <button onClick={() => setCollapsed(true)}
            className="p-1.5 rounded-md hover:bg-elevated text-foreground-muted hover:text-foreground-secondary transition-colors" title="Collapse">
            <PanelRightClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Tool buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            {tools.map(tool => {
              const Icon = tool.icon;
              const isLoading = generating === tool.id;
              return (
                <button key={tool.id} onClick={() => handleToolClick(tool.id)} disabled={isLoading}
                  className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-lg border border-border hover:border-border-hover hover:bg-elevated transition-colors disabled:opacity-50 group">
                  {isLoading ? <Loader2 size={16} className="animate-spin text-foreground-muted" />
                    : <Icon size={16} className="text-foreground-muted group-hover:text-foreground-secondary transition-all" />}
                  <span className="text-[11px] text-foreground-secondary group-hover:text-foreground transition-colors">{tool.label}</span>
                </button>
              );
            })}
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[12px] text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</motion.p>
            )}
          </AnimatePresence>

          {/* Current view: Audio Overview */}
          {showAudioOverview && (
            <>
              <div className="border-t border-border" />
              <AudioOverview notebookId={notebookId} />
            </>
          )}

          {/* Saved generations list */}
          {!showAudioOverview && (
            <>
              <div className="border-t border-border" />
              {generations.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[10px] text-foreground-muted uppercase tracking-wider px-1 mb-1">Saved ({generations.length})</p>
                  {generations.map(gen => {
                    const isInteractive = gen.type === 'quiz' || gen.type === 'flashcards';
                    const typeIcon = gen.type === 'quiz' ? BookOpen : gen.type === 'flashcards' ? Layers : gen.type === 'study-guide' ? BookOpen : RefreshCw;
                    const TypeIcon = typeIcon;
                    return (
                    <div key={gen.id} className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-elevated transition-colors cursor-pointer"
                      onClick={() => {
                        if (isInteractive) {
                          // Load saved data into center panel
                          try {
                            const data = JSON.parse(gen.content);
                            window.dispatchEvent(new CustomEvent('memorwise:load-generation', { detail: { type: gen.type, data } }));
                          } catch { /* invalid JSON, just open view */ }
                          onViewChange(gen.type);
                        } else {
                          setViewingGen(gen);
                        }
                      }}>
                      <TypeIcon size={13} className="text-foreground-muted shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-foreground truncate">{gen.title}</p>
                        <p className="text-[10px] text-foreground-muted">{new Date(gen.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteGeneration(gen.id); }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-card text-foreground-muted hover:text-destructive transition-all shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <img src="/logo-mark.png" alt="" className="h-5 logo-adaptive opacity-30 mb-2" style={{ width: 'auto' }} />
                  <p className="text-[12px] text-foreground-muted">Studio output will appear here</p>
                  <p className="text-[11px] text-foreground-muted/60 mt-0.5">Use the tools above to generate content</p>
                </div>
              )}

              {/* Viewing a study guide or summary inline */}
              {viewingGen && (
                <div className="space-y-2 mt-2">
                  <div className="flex items-center justify-between">
                    <button onClick={() => setViewingGen(null)} className="text-[11px] text-accent-blue hover:underline">← Back</button>
                    <button onClick={() => deleteGeneration(viewingGen.id)} className="p-1 rounded hover:bg-elevated text-foreground-muted hover:text-destructive">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <h3 className="text-[13px] font-medium text-foreground">{viewingGen.title}</h3>
                  <div className="markdown-body text-[12px]">
                    <MarkdownRenderer content={viewingGen.content} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
