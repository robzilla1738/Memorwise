'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowRight, Trash2 } from 'lucide-react';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';
import { TopBar } from '@/components/layout/TopBar';
import { SourcesPanel } from '@/components/layout/SourcesPanel';
import { MainLayout, type CenterView } from '@/components/layout/MainLayout';
import { StudioPanel } from '@/components/layout/StudioPanel';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { SearchModal } from '@/components/search/SearchModal';
import { useNotebookStore } from '@/stores/notebook-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useChatStore } from '@/stores/chat-store';
import { ToastContainer } from '@/components/ui/Toast';
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog';

function WelcomeScreen() {
  const { notebooks, createNotebook, selectNotebook, loadNotebooks, deleteNotebook } = useNotebookStore();
  const { loadSessions } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setIsCreating(false);
      setNewName('');
      return;
    }
    const nb = await createNotebook(name);
    setIsCreating(false);
    setNewName('');
    await selectNotebook(nb.id);
    await loadSessions(nb.id);
  };

  const handleSelect = async (id: string) => {
    await selectNotebook(id);
    await loadSessions(id);
  };

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="text-center max-w-md w-full"
      >
        <div className="w-14 h-14 rounded-2xl bg-elevated flex items-center justify-center mx-auto mb-5">
          <img src="/logo-mark.png" alt="Memorwise" className="w-9 h-9 object-contain logo-adaptive" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Welcome to Memorwise
        </h1>
        <p className="text-sm text-foreground-secondary mb-8">
          Your local, open-source notebook for chatting with documents.
          <br />
          Create a notebook to get started.
        </p>

        {/* Existing notebooks */}
        {notebooks.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] text-foreground-muted uppercase tracking-wider mb-3">
              Your notebooks
            </p>
            <div className="grid grid-cols-2 gap-2">
              {notebooks.map((nb) => (
                <div key={nb.id}
                  className="flex items-center justify-between px-4 py-3 bg-card border border-border hover:border-border-subtle rounded-xl text-left transition-colors group relative">
                  <button onClick={() => handleSelect(nb.id)} className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">{nb.name}</div>
                      <div className="text-[11px] text-foreground-muted">{new Date(nb.created_at).toLocaleDateString()}</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({ title: 'Delete notebook', message: `"${nb.name}" and all its data will be permanently deleted.`, confirmLabel: 'Delete', destructive: true });
                      if (ok) { await deleteNotebook(nb.id); toast('success', 'Notebook deleted'); }
                    }} className="p-1 rounded opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-destructive transition-all">
                      <Trash2 size={13} />
                    </button>
                    <ArrowRight size={14} className="text-foreground-muted group-hover:text-foreground-secondary" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create notebook */}
        {isCreating ? (
          <div className="flex items-center gap-2 justify-center">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewName('');
                }
              }}
              onBlur={handleCreate}
              autoFocus
              placeholder="Notebook name..."
              className="px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring"
            />
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={16} />
            Create notebook
          </button>
        )}

      </motion.div>
    </div>
  );
}

export default function Home() {
  const loadNotebooks = useNotebookStore((s) => s.loadNotebooks);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const selectedNotebookId = useNotebookStore((s) => s.selectedNotebookId);

  const [activeView, setActiveView] = useState<CenterView>('chat');

  useEffect(() => {
    loadNotebooks();
    loadSettings();
  }, [loadNotebooks, loadSettings]);

  // Reset view when notebook changes
  useEffect(() => {
    setActiveView('chat');
  }, [selectedNotebookId]);

  const handleStudioViewChange = (view: string) => {
    if (
      view === 'flashcards' ||
      view === 'graph' ||
      view === 'notes' ||
      view === 'chat' ||
      view === 'quiz'
    ) {
      setActiveView(view as CenterView);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-surface">
      <TopBar />

      {!selectedNotebookId ? (
        <WelcomeScreen />
      ) : (
        <div className="flex-1 flex p-1.5 overflow-hidden" style={{ gap: '6px' }}>
          <SourcesPanel />
          <MainLayout activeView={activeView} setActiveView={setActiveView} />
          <StudioPanel
            notebookId={selectedNotebookId}
            onViewChange={handleStudioViewChange}
          />
        </div>
      )}

      <SettingsModal />
      <SearchModal />
      <ToastContainer />
      <ConfirmDialogProvider />
    </div>
  );
}
