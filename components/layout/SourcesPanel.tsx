'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Search,
  Trash2,
  Globe,
  Youtube,
  Image,
  Music,
  Copy,
  StickyNote,
  FolderPlus,
} from 'lucide-react';
import { useNotebookStore } from '@/stores/notebook-store';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';
import type { Source } from '@/lib/types';

function getFileIcon(source: Source) {
  switch (source.source_type) {
    case 'url':
      return <Globe size={16} className="text-green-400" />;
    case 'youtube':
      return <Youtube size={16} className="text-red-400" />;
    case 'image':
      return <Image size={16} className="text-orange-400" />;
    case 'audio':
      return <Music size={16} className="text-blue-400" />;
    default:
      break;
  }
  switch (source.filetype) {
    case 'pdf':
      return <FileText size={16} className="text-red-400" />;
    case 'csv':
    case 'xlsx':
    case 'xls':
      return <FileSpreadsheet size={16} className="text-green-400" />;
    case 'md':
    case 'txt':
      return <FileCode size={16} className="text-blue-400" />;
    case 'docx':
    case 'doc':
      return <FileText size={16} className="text-blue-400" />;
    default:
      return <File size={16} className="text-foreground-secondary" />;
  }
}

function StatusBadge({ status }: { status: Source['status'] }) {
  switch (status) {
    case 'pending':
    case 'processing':
      return <span title="Processing..."><Loader2 size={13} className="animate-spin text-warning shrink-0" /></span>;
    case 'ready':
      return <span title="Ready"><CheckCircle2 size={13} className="text-success shrink-0" /></span>;
    case 'error':
      return <span title="Needs re-indexing"><AlertCircle size={13} className="text-warning shrink-0" /></span>;
    default:
      return null;
  }
}

export function SourcesPanel() {
  const {
    selectedNotebookId,
    sources,
    addSource,
    addUrlSource,
    deleteSource,
    refreshSources,
    setViewingSource,
  } = useNotebookStore();

  const [urlValue, setUrlValue] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [hoveredSourceId, setHoveredSourceId] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'sources' | 'notes'>('sources');
  const [notesList, setNotesList] = useState<any[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [noteTemplates, setNoteTemplates] = useState<{ id: string; name: string; content: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load notes when tab switches
  useEffect(() => {
    if (sidebarTab === 'notes' && selectedNotebookId) {
      loadNotes();
    }
  }, [sidebarTab, selectedNotebookId]);

  const loadNotes = async () => {
    if (!selectedNotebookId) return;
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/notes?notebookId=${selectedNotebookId}`);
      if (res.ok) setNotesList(await res.json());
    } catch {} finally { setNotesLoading(false); }
  };

  const handleCreateNote = async (title?: string, content?: string) => {
    if (!selectedNotebookId) return;
    setCreatingNote(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId: selectedNotebookId, title: title || 'Untitled', content: content || '' }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotesList(prev => [note, ...prev]);
        setShowTemplates(false);
        window.dispatchEvent(new CustomEvent('memorwise:select-note', { detail: { noteId: note.id } }));
      }
    } catch {} finally { setCreatingNote(false); }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/notes/templates');
      if (res.ok) setNoteTemplates(await res.json());
    } catch {}
  };

  // Poll sources that are pending/processing
  useEffect(() => {
    const hasPending = sources.some(
      (s) => s.status === 'pending' || s.status === 'processing'
    );
    if (!hasPending) return;

    const interval = setInterval(() => {
      refreshSources();
    }, 3000);

    return () => clearInterval(interval);
  }, [sources, refreshSources]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const count = e.target.files.length;
      addSource(e.target.files);
      toast('info', `Processing ${count} file${count > 1 ? 's' : ''}...`);
      e.target.value = '';
    }
  };

  const handleUrlSubmit = async () => {
    const url = urlValue.trim();
    if (!url) return;
    setUrlLoading(true);
    setUrlError(null);
    try {
      await addUrlSource(url);
      setUrlValue('');
      toast('info', 'Processing URL...');
    } catch (err: any) {
      setUrlError(err.message || 'Failed to add URL');
    } finally {
      setUrlLoading(false);
    }
  };

  if (!selectedNotebookId) return null;

  return (
    <div className="w-[280px] min-w-[280px] h-full bg-card rounded-xl flex flex-col overflow-hidden border border-border">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <div className="flex items-center bg-elevated rounded-md p-0.5">
          <button onClick={() => setSidebarTab('sources')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              sidebarTab === 'sources' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground-secondary'
            }`}>Sources</button>
          <button onClick={() => setSidebarTab('notes')}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              sidebarTab === 'notes' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted hover:text-foreground-secondary'
            }`}>Notes</button>
        </div>
        <button className="p-1.5 rounded-md hover:bg-elevated text-foreground-muted hover:text-foreground-secondary transition-colors" title="Select all">
          <Copy size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {sidebarTab === 'notes' ? (
          /* Notes list */
          <div className="space-y-2">
            <div className="flex gap-2">
              <button onClick={() => handleCreateNote()} disabled={creatingNote}
                className="flex-1 py-2.5 border border-border hover:border-border-hover rounded-lg text-[13px] text-foreground-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2">
                {creatingNote ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                New note
              </button>
              <button onClick={() => { setShowTemplates(!showTemplates); if (!showTemplates) loadTemplates(); }}
                className={`px-3 py-2.5 border rounded-lg text-[13px] transition-colors ${showTemplates ? 'border-accent-blue text-accent-blue bg-accent-blue/5' : 'border-border text-foreground-muted hover:text-foreground-secondary hover:border-border-hover'}`}
                title="New from template">
                <StickyNote size={14} />
              </button>
            </div>
            {showTemplates && (
              <div className="space-y-1 p-2 bg-elevated rounded-lg">
                <p className="text-[11px] text-foreground-muted uppercase tracking-wider px-1 mb-1">From template</p>
                {noteTemplates.length === 0 ? (
                  <p className="text-[11px] text-foreground-muted px-1 py-2">No templates yet. Open a note and click the bookmark icon to save it as a template.</p>
                ) : noteTemplates.map(t => (
                  <button key={t.id} onClick={() => handleCreateNote(t.name, t.content)}
                    className="w-full text-left px-2 py-1.5 text-[12px] text-foreground-secondary hover:text-foreground hover:bg-card rounded-md transition-colors truncate">
                    {t.name}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {notesLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-foreground-muted" /></div>
              ) : notesList.length === 0 ? (
                <div className="text-center py-8">
                  <StickyNote size={24} className="mx-auto mb-2 text-foreground-muted" />
                  <p className="text-[13px] text-foreground-muted">No notes yet</p>
                  <p className="text-[11px] text-foreground-muted/60 mt-1">Click above to create one</p>
                </div>
              ) : (
                notesList.map((n: any) => (
                  <div key={n.id}
                    onClick={() => {
                      window.dispatchEvent(new CustomEvent('memorwise:select-note', { detail: { noteId: n.id } }));
                    }}
                    className="px-3 py-2.5 rounded-lg text-[13px] hover:bg-elevated transition-colors cursor-pointer">
                    <div className="flex items-center gap-2">
                      <StickyNote size={14} className="text-foreground-muted shrink-0" />
                      <span className="font-medium text-foreground-secondary truncate">{n.title || 'Untitled'}</span>
                    </div>
                    <div className="text-[11px] text-foreground-muted mt-0.5 truncate pl-5">
                      {n.content ? n.content.slice(0, 60) + '...' : 'Empty'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
        <>
        {/* Add sources button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 border border-border hover:border-border-hover rounded-lg text-[13px] text-foreground-secondary hover:text-foreground transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={14} />
          Add sources
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.csv,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.png,.jpg,.jpeg,.gif,.bmp,.webp,.mp3,.wav,.flac,.ogg,.m4a,.mp4,.mkv,.avi,.mov,.webm"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* URL Input */}
        <div className="space-y-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted"
            />
            <input
              type="text"
              value={urlValue}
              onChange={(e) => {
                setUrlValue(e.target.value);
                setUrlError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUrlSubmit();
              }}
              placeholder="Paste a URL..."
              disabled={urlLoading}
              className="w-full pl-8 pr-3 py-2.5 text-[13px] bg-input border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            {urlLoading && (
              <Loader2
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-foreground-muted"
              />
            )}
          </div>
          <AnimatePresence>
            {urlError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-[12px] text-error flex items-center gap-1.5"
              >
                <AlertCircle size={12} />
                {urlError}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Re-index banner for error sources */}
        {sources.some(s => s.status === 'error') && (
          <button
            onClick={async () => {
              toast('info', 'Re-indexing sources — check embedding model in Settings if this fails');
              await fetch('/api/sources/reindex-all', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notebookId: selectedNotebookId }),
              });
              // Poll until sources update (up to 30s)
              for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 3000));
                await refreshSources();
                const current = useNotebookStore.getState().sources;
                if (!current.some(s => s.status === 'processing' || s.status === 'pending')) break;
              }
              refreshSources();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 bg-warning/5 border border-warning/10 rounded-lg text-[11px] text-warning hover:bg-warning/10 transition-colors">
            <AlertCircle size={12} />
            <span>Some sources need re-indexing</span>
            <span className="ml-auto text-[10px] underline">Fix now</span>
          </button>
        )}

        {/* Source list — draggable */}
        {sources.length > 0 ? (
          <div className="space-y-1">
            {sources.map((src) => (
              <div
                key={src.id}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', src.id); e.dataTransfer.effectAllowed = 'move'; }}
                onMouseEnter={() => setHoveredSourceId(src.id)}
                onMouseLeave={() => setHoveredSourceId(null)}
                onClick={() => setViewingSource(src)}
                className="group flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] text-foreground-secondary hover:bg-elevated transition-colors cursor-grab active:cursor-grabbing"
              >
                {getFileIcon(src)}
                <span className="truncate flex-1">{src.filename}</span>
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={src.status} />
                  {hoveredSourceId === src.id && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirm({
                          title: 'Delete source',
                          message: `"${src.filename}" will be permanently removed along with its embeddings.`,
                          confirmLabel: 'Delete',
                          destructive: true,
                        });
                        if (ok) {
                          await deleteSource(src.id);
                          toast('success', `Deleted "${src.filename}"`);
                        }
                      }}
                      className="p-0.5 rounded hover:bg-border-subtle text-foreground-muted hover:text-destructive transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <File size={24} className="text-foreground-muted mb-2" />
            <p className="text-[13px] text-foreground-muted mb-1">
              Saved sources will appear here
            </p>
            <p className="text-[12px] text-foreground-muted/60">
              Upload files or paste a URL to add sources
            </p>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
