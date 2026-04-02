'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Loader2, Link2, Eye, Code, BookmarkPlus } from 'lucide-react';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';
import type { Note } from '@/lib/types';

interface Backlink {
  id: string;
  title: string;
}

export function NoteEditor({ noteId, notebookId }: { noteId: string; notebookId: string }) {
  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [deleted, setDeleted] = useState(false);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('preview');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setDeleted(false);
    fetch(`/api/notes/${noteId}`)
      .then(res => { if (!res.ok) throw new Error('Failed'); return res.json(); })
      .then((data: Note) => { setNote(data); setTitle(data.title); setContent(data.content); })
      .catch(() => toast('error', 'Failed to load note'))
      .finally(() => setLoading(false));
  }, [noteId]);

  useEffect(() => {
    fetch(`/api/notes/${noteId}/backlinks`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setBacklinks(data || []))
      .catch(() => setBacklinks([]));
  }, [noteId]);

  const saveNote = useCallback(async (newTitle: string, newContent: string) => {
    setSaving(true);
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle, content: newContent }) });
    } catch {
      toast('error', 'Failed to save note');
    } finally { setSaving(false); }
  }, [noteId]);

  const scheduleSave = useCallback((newTitle: string, newContent: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNote(newTitle, newContent), 1000);
  }, [saveNote]);

  const handleTitleChange = (val: string) => { setTitle(val); scheduleSave(val, content); };
  const handleContentChange = (val: string) => { setContent(val); scheduleSave(title, val); };
  const handleBlur = () => { if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; } saveNote(title, content); };

  // Clear debounce on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Cmd+S to force save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
        saveNote(title, content);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [title, content, saveNote]);

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete note',
      message: `"${title || 'Untitled'}" will be permanently deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
      setDeleted(true);
      toast('success', 'Note deleted');
    } catch {
      toast('error', 'Failed to delete note');
    }
  };

  const handleSaveAsTemplate = async () => {
    try {
      const res = await fetch('/api/notes/templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title || 'Untitled Template', content }),
      });
      if (res.ok) toast('success', 'Saved as template');
      else toast('error', 'Failed to save template');
    } catch { toast('error', 'Failed to save template'); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-foreground-muted" /></div>;
  if (deleted) return <div className="flex-1 flex items-center justify-center"><p className="text-sm text-foreground-muted">Note deleted. Select another note or create a new one.</p></div>;
  if (!note) return <div className="flex-1 flex items-center justify-center"><p className="text-sm text-foreground-muted">Note not found.</p></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center gap-2 flex-1">
          <input type="text" value={title} onChange={e => handleTitleChange(e.target.value)} onBlur={handleBlur}
            placeholder="Note title..."
            aria-label="Note title"
            className="flex-1 text-sm font-medium bg-transparent text-foreground placeholder:text-foreground-muted focus:outline-none" />
          {saving && <span className="text-[11px] text-foreground-muted">Saving...</span>}
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center bg-elevated rounded-md p-0.5" role="tablist">
            <button onClick={() => setViewMode('preview')} role="tab" aria-selected={viewMode === 'preview'}
              className={`p-1.5 rounded transition-colors ${viewMode === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground-secondary'}`}
              title="Preview">
              <Eye size={14} />
            </button>
            <button onClick={() => setViewMode('edit')} role="tab" aria-selected={viewMode === 'edit'}
              className={`p-1.5 rounded transition-colors ${viewMode === 'edit' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground-secondary'}`}
              title="Edit markdown">
              <Code size={14} />
            </button>
          </div>
          <button onClick={handleSaveAsTemplate} className="p-1.5 rounded-md text-foreground-muted hover:text-accent-blue hover:bg-elevated transition-colors" title="Save as template">
            <BookmarkPlus size={16} />
          </button>
          <button onClick={handleDelete} className="p-1.5 rounded-md text-foreground-muted hover:text-destructive hover:bg-elevated transition-colors" title="Delete note">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {viewMode === 'edit' ? (
          <textarea value={content} onChange={e => handleContentChange(e.target.value)} onBlur={handleBlur}
            placeholder="Start writing markdown... Use [[wiki-links]] to link to other notes."
            aria-label="Note content"
            className="w-full h-full p-4 text-sm bg-transparent text-foreground placeholder:text-foreground-muted resize-none focus:outline-none leading-relaxed font-mono" />
        ) : (
          <div className="p-4">
            {content.trim() ? (
              <div className="markdown-body">
                <MarkdownRenderer content={content} />
              </div>
            ) : (
              <p className="text-sm text-foreground-muted italic">
                Empty note. Click the <Code size={12} className="inline align-text-bottom" /> button to start writing.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={14} className="text-foreground-muted" />
            <span className="text-[12px] font-medium text-foreground-muted uppercase tracking-wider">Backlinks</span>
          </div>
          <div className="space-y-1">
            {backlinks.map(bl => (
              <button key={bl.id}
                onClick={() => window.dispatchEvent(new CustomEvent('memorwise:select-note', { detail: { noteId: bl.id } }))}
                className="block text-[13px] text-accent-blue hover:underline cursor-pointer">
                {bl.title || 'Untitled'}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
