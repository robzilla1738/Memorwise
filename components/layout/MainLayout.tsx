'use client';

import { useState, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNotebookStore } from '@/stores/notebook-store';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { GraphView } from '@/components/graph/GraphView';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { FlashcardView } from '@/components/flashcards/FlashcardView';
import { QuizView } from '@/components/quiz/QuizView';
import { SourceViewer } from '@/components/sources/SourceViewer';
import { useEffect } from 'react';
import { StickyNote, MessageSquare, Network } from 'lucide-react';

export type CenterView = 'chat' | 'notes' | 'graph' | 'flashcards' | 'quiz';

interface MainLayoutProps {
  activeView: CenterView;
  setActiveView: (view: CenterView) => void;
}

export function MainLayout({ activeView, setActiveView }: MainLayoutProps) {
  const { selectedNotebookId, viewingSource, setViewingSource, addSource } =
    useNotebookStore();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Listen for note selection from sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.noteId) {
        setSelectedNoteId(detail.noteId);
        setActiveView('notes');
      }
    };
    window.addEventListener('memorwise:select-note', handler);
    return () => window.removeEventListener('memorwise:select-note', handler);
  }, [setActiveView]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        addSource(e.dataTransfer.files);
      }
    },
    [addSource]
  );

  if (!selectedNotebookId) return null;

  return (
    <div
      className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-accent-blue/5 border-2 border-dashed border-accent-blue rounded-xl flex items-center justify-center">
          <p className="text-sm text-accent-blue font-medium">Drop files to add sources</p>
        </div>
      )}

      {/* View tabs */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-card shrink-0">
        {([
          { key: 'chat', label: 'Chat', icon: MessageSquare },
          { key: 'graph', label: 'Graph', icon: Network },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md transition-colors ${
              activeView === tab.key
                ? 'bg-elevated text-foreground'
                : 'text-foreground-muted hover:text-foreground-secondary hover:bg-elevated/50'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* View content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeView === 'chat' && <ChatPanel />}
          {activeView === 'graph' && (
            <GraphView notebookId={selectedNotebookId} />
          )}
          {activeView === 'flashcards' && (
            <FlashcardView notebookId={selectedNotebookId} />
          )}
          {activeView === 'quiz' && (
            <QuizView notebookId={selectedNotebookId} />
          )}

          {activeView === 'notes' && (
            selectedNoteId ? (
              <NoteEditor
                key={selectedNoteId}
                noteId={selectedNoteId}
                notebookId={selectedNotebookId}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <StickyNote size={32} className="mx-auto mb-2 text-foreground-muted" />
                  <p className="text-[13px] text-foreground-muted">
                    Select a note from the sidebar or create a new one
                  </p>
                </div>
              </div>
            )
          )}
        </div>

        {/* Source viewer panel (slides in from right) */}
        <AnimatePresence>
          {viewingSource && (
            <SourceViewer
              source={viewingSource}
              onClose={() => setViewingSource(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
