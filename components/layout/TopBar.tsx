'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  Plus,
  ChevronDown,
  Check,
  Trash2,
  Search,
  Download,
  Sun,
  Moon,
} from 'lucide-react';
import { useNotebookStore } from '@/stores/notebook-store';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import { toast } from '@/components/ui/Toast';
import { confirm } from '@/components/ui/ConfirmDialog';

export function TopBar() {
  const { notebooks, selectedNotebookId, selectNotebook, createNotebook, deleteNotebook } = useNotebookStore();
  const { loadSessions } = useChatStore();
  const { openSettings } = useSettingsStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLInputElement>(null);

  const selectedNotebook = notebooks.find((n) => n.id === selectedNotebookId);

  useEffect(() => { setIsDark(document.documentElement.classList.contains('dark')); }, []);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  useEffect(() => { if (isRenaming && renameRef.current) renameRef.current.focus(); }, [isRenaming]);
  useEffect(() => { if (isCreating && createRef.current) createRef.current.focus(); }, [isCreating]);

  const handleSelectNotebook = async (id: string) => { setDropdownOpen(false); await selectNotebook(id); await loadSessions(id); };

  const handleRename = async () => {
    const name = renameValue.trim();
    if (name && selectedNotebookId) {
      try {
        const res = await fetch(`/api/notebooks/${selectedNotebookId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
        if (res.ok) await useNotebookStore.getState().loadNotebooks();
        else toast('error', 'Failed to rename notebook');
      } catch { toast('error', 'Failed to rename notebook'); }
    }
    setIsRenaming(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) { setIsCreating(false); setNewName(''); return; }
    const nb = await createNotebook(name);
    setIsCreating(false); setNewName('');
    await handleSelectNotebook(nb.id);
  };

  const toggleTheme = () => {
    const html = document.documentElement;
    const goLight = html.classList.contains('dark');
    html.classList.toggle('dark', !goLight);
    html.classList.toggle('light', goLight);
    setIsDark(!goLight);
    localStorage.setItem('theme', goLight ? 'light' : 'dark');
  };

  const handleExport = async () => {
    if (!selectedNotebookId) return;
    try {
      const res = await fetch(`/api/export?notebookId=${selectedNotebookId}&type=notebook`);
      if (!res.ok) return;
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${selectedNotebook?.name || 'notebook'}_export.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast('success', 'Notebook exported');
    } catch { toast('error', 'Failed to export notebook'); }
  };

  return (
    <div className="h-11 min-h-11 flex items-center justify-between px-4 bg-card border-b border-border">
      {/* Left: Logo + Notebook name */}
      <div className="flex items-center gap-6">
        <img src="/logo-full.png" alt="Memorwise" className="h-[18px] logo-adaptive cursor-pointer"
          onClick={() => selectNotebook(null)} />

        {selectedNotebook && (
          isRenaming ? (
            <input ref={renameRef} type="text" value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false); }}
              onBlur={handleRename}
              className="px-2 py-0.5 text-[13px] bg-input border border-border rounded-md text-foreground focus:ring-1 focus:ring-ring w-36" />
          ) : (
            <button onClick={() => { setRenameValue(selectedNotebook.name); setIsRenaming(true); }}
              className="text-[13px] font-medium text-foreground hover:text-accent-blue transition-colors truncate max-w-[180px]">
              {selectedNotebook.name}
            </button>
          )
        )}
      </div>

      {/* Right: Search + Dropdown + Create + Icons */}
      <div className="flex items-center gap-1.5">
        {/* Search */}
        {selectedNotebookId && (
          <button onClick={() => window.dispatchEvent(new CustomEvent('memorwise:open-search'))}
            className="flex items-center gap-1.5 px-2.5 py-1 mr-1 text-[12px] text-foreground-muted hover:text-foreground-secondary bg-elevated/60 hover:bg-elevated border border-border/60 rounded-lg transition-colors"
            title="Search (Cmd+K)">
            <Search size={12} />
            <span>Search</span>
            <kbd className="ml-1 px-1 py-0 text-[10px] font-medium text-foreground-muted/70 bg-card border border-border rounded">⌘K</kbd>
          </button>
        )}

        {/* Notebook switcher */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} title="Switch notebook"
            className="p-1.5 rounded-lg hover:bg-elevated text-foreground-muted hover:text-foreground transition-colors">
            <ChevronDown size={14} />
          </button>
          <AnimatePresence>
            {dropdownOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1.5 w-56 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-1.5 max-h-64 overflow-y-auto">
                  {notebooks.map(nb => (
                    <div key={nb.id} onMouseEnter={() => setHoveredId(nb.id)} onMouseLeave={() => setHoveredId(null)}
                      onClick={() => handleSelectNotebook(nb.id)}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer text-[13px] transition-colors ${
                        selectedNotebookId === nb.id ? 'bg-elevated text-foreground' : 'text-foreground-secondary hover:bg-elevated/50 hover:text-foreground'
                      }`}>
                      <span className="truncate flex-1">{nb.name}</span>
                      <div className="flex items-center gap-1">
                        {selectedNotebookId === nb.id && <Check size={12} className="text-accent-blue" />}
                        {hoveredId === nb.id && (
                          <button onClick={async (e) => {
                            e.stopPropagation();
                            const ok = await confirm({ title: 'Delete notebook', message: `"${nb.name}" and all its data will be permanently deleted.`, confirmLabel: 'Delete', destructive: true });
                            if (ok) { await deleteNotebook(nb.id); toast('success', 'Notebook deleted'); }
                          }} className="p-0.5 rounded hover:bg-elevated text-foreground-muted hover:text-destructive">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {notebooks.length === 0 && <div className="px-3 py-3 text-[12px] text-foreground-muted text-center">No notebooks yet</div>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border mx-0.5" />

        {/* Create */}
        {isCreating ? (
          <input ref={createRef} type="text" value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setIsCreating(false); setNewName(''); } }}
            onBlur={handleCreate} placeholder="Name..."
            className="w-24 px-2 py-0.5 text-[12px] bg-input border border-border rounded-md text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring" />
        ) : (
          <button onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium text-foreground-secondary hover:text-foreground border border-border hover:border-border-hover rounded-lg hover:bg-elevated transition-colors">
            <Plus size={13} />
            Create
          </button>
        )}

        {/* Icon buttons */}
        <button onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}
          className="p-1.5 rounded-lg hover:bg-elevated text-foreground-muted hover:text-foreground transition-colors">
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>
        {selectedNotebookId && (
          <button onClick={handleExport} title="Export"
            className="p-1.5 rounded-lg hover:bg-elevated text-foreground-muted hover:text-foreground transition-colors">
            <Download size={14} />
          </button>
        )}
        <button onClick={openSettings} title="Settings"
          className="p-1.5 rounded-lg hover:bg-elevated text-foreground-muted hover:text-foreground transition-colors">
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
