'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ArrowRight, Trash2, Settings, MessageSquare, Brain, BookOpen, Headphones } from 'lucide-react';
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
  const { notebooks, createNotebook, selectNotebook, deleteNotebook } = useNotebookStore();
  const { openSettings, providers } = useSettingsStore();
  const { loadSessions } = useChatStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const hasProvider = providers.some(p => p.available);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setIsCreating(false); setNewName(''); return; }
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
    <div className="flex-1 flex items-start justify-center pt-[10vh] px-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-[520px] pb-20"
      >
        {/* Heading */}
        <h1 className="text-xl font-medium tracking-tight text-foreground mb-2">
          Welcome to Memorwise
        </h1>
        <p className="text-[13px] text-foreground-muted mb-10">
          Drop in your documents, connect an LLM, and start chatting.
        </p>

        {/* Steps */}
        <div className="space-y-6 mb-10">
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-[12px] text-foreground-muted shrink-0">1</div>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-6">
              <p className="text-[13px] font-medium text-foreground-secondary mb-1">Connect a provider</p>
              <p className="text-[12px] text-foreground-muted leading-relaxed">
                Open Settings and add at least one LLM provider — Ollama, OpenAI, Anthropic, or any of the 8 supported providers.
              </p>
              {!hasProvider && (
                <button onClick={openSettings}
                  className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-accent-blue hover:text-accent-blue/80 transition-colors">
                  <Settings className="h-3 w-3" />
                  Open Settings
                </button>
              )}
              {hasProvider && (
                <p className="mt-2 text-[11px] text-success">Provider connected</p>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-[12px] text-foreground-muted shrink-0">2</div>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="pb-6">
              <p className="text-[13px] font-medium text-foreground-secondary mb-1">Create a notebook</p>
              <p className="text-[12px] text-foreground-muted leading-relaxed">
                Notebooks hold your sources, chats, notes, and generated study materials — all in one place.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-[12px] text-foreground-muted shrink-0">3</div>
            </div>
            <div>
              <p className="text-[13px] font-medium text-foreground-secondary mb-1">Add sources and chat</p>
              <p className="text-[12px] text-foreground-muted leading-relaxed">
                Upload PDFs, images, audio, video, URLs, or YouTube links. Then ask questions grounded in your content.
              </p>
            </div>
          </div>
        </div>

        {/* Existing notebooks */}
        {notebooks.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] text-foreground-muted uppercase tracking-wider mb-3">Your notebooks</p>
            <div className="grid grid-cols-2 gap-2">
              {notebooks.map((nb) => (
                <div key={nb.id}
                  className="flex items-center justify-between px-4 py-3 bg-card border border-border hover:border-border-subtle rounded-xl text-left transition-colors group">
                  <button onClick={() => handleSelect(nb.id)} className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{nb.name}</div>
                    <div className="text-[11px] text-foreground-muted">{new Date(nb.created_at).toLocaleDateString()}</div>
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

        {/* Create notebook CTA */}
        {isCreating ? (
          <div className="flex items-center gap-2">
            <input type="text" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewName(''); } }}
              onBlur={handleCreate} autoFocus placeholder="Notebook name..."
              className="flex-1 px-3 py-2.5 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring" />
          </div>
        ) : (
          <button onClick={() => setIsCreating(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] font-medium transition-colors">
            <Plus className="h-4 w-4" />
            {notebooks.length > 0 ? 'Create notebook' : 'Create your first notebook'}
          </button>
        )}

        {/* Capabilities */}
        <div className="mt-14 pt-8 border-t border-border">
          <p className="text-[11px] uppercase tracking-wider text-foreground-muted mb-4">What you can do</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <MessageSquare className="h-3.5 w-3.5" />, label: 'Chat with documents' },
              { icon: <Brain className="h-3.5 w-3.5" />, label: 'Knowledge graph' },
              { icon: <BookOpen className="h-3.5 w-3.5" />, label: 'Flashcards & quizzes' },
              { icon: <Headphones className="h-3.5 w-3.5" />, label: 'Audio overview' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2.5 text-[12px] text-foreground-muted">
                <span className="text-foreground-muted/70">{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center gap-4 text-[11px] text-foreground-muted/60">
          <a href="https://memorwise.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground-muted transition-colors">Website</a>
          <span>·</span>
          <a href="https://github.com/robzilla1738/Memorwise" target="_blank" rel="noopener noreferrer" className="hover:text-foreground-muted transition-colors">GitHub</a>
          <span>·</span>
          <a href="https://github.com/robzilla1738/Memorwise#readme" target="_blank" rel="noopener noreferrer" className="hover:text-foreground-muted transition-colors">Documentation</a>
        </div>
      </motion.div>
    </div>
  );
}

export default function Home() {
  const loadNotebooks = useNotebookStore((s) => s.loadNotebooks);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadProviders = useSettingsStore((s) => s.loadProviders);
  const selectedNotebookId = useNotebookStore((s) => s.selectedNotebookId);

  const [activeView, setActiveView] = useState<CenterView>('chat');

  useEffect(() => {
    loadNotebooks();
    loadSettings();
    loadProviders();
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
