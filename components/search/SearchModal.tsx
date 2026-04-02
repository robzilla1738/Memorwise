'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, StickyNote, MessageSquare, X } from 'lucide-react';
import { useNotebookStore } from '@/stores/notebook-store';

interface SearchResult {
  id: string;
  type: 'source' | 'note' | 'message';
  title: string;
  snippet: string;
}

const typeIcons = {
  source: FileText,
  note: StickyNote,
  message: MessageSquare,
};

const typeLabels = {
  source: 'Sources',
  note: 'Notes',
  message: 'Messages',
};

export function SearchModal() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedNotebookId = useNotebookStore((s) => s.selectedNotebookId);

  const openModal = useCallback(() => {
    setOpen(true);
    setQuery('');
    setResults([]);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setQuery('');
    setResults([]);
  }, []);

  // Listen for Cmd+K / Ctrl+K and custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          closeModal();
        } else {
          openModal();
        }
      }
      if (e.key === 'Escape' && open) {
        closeModal();
      }
    };

    const handleCustomOpen = () => openModal();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('memorwise:open-search', handleCustomOpen);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('memorwise:open-search', handleCustomOpen);
    };
  }, [open, openModal, closeModal]);

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        if (selectedNotebookId) params.set('notebookId', selectedNotebookId);
        const res = await fetch(`/api/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedNotebookId]);

  const handleResultClick = (result: SearchResult) => {
    closeModal();
    window.dispatchEvent(
      new CustomEvent('memorwise:search-navigate', { detail: result })
    );
  };

  // Highlight matching text in snippet
  const highlightSnippet = (snippet: string) => {
    if (!query.trim()) return snippet;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = snippet.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-accent-blue/20 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          onClick={closeModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search size={18} className="text-foreground-muted shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sources, notes, messages..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="p-0.5 rounded hover:bg-elevated text-foreground-muted hover:text-foreground-secondary"
                >
                  <X size={14} />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted bg-elevated border border-border rounded">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto">
              {loading && query.trim() && (
                <div className="px-4 py-6 text-center text-sm text-foreground-muted">
                  Searching...
                </div>
              )}

              {!loading && query.trim() && results.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-foreground-muted">
                  No results found for &ldquo;{query}&rdquo;
                </div>
              )}

              {!loading &&
                Object.entries(grouped).map(([type, items]) => {
                  const Icon = typeIcons[type as keyof typeof typeIcons];
                  const label = typeLabels[type as keyof typeof typeLabels] || type;
                  return (
                    <div key={type}>
                      <div className="px-4 pt-3 pb-1.5">
                        <span className="text-[11px] font-medium text-foreground-muted uppercase tracking-wider">
                          {label}
                        </span>
                      </div>
                      {items.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-elevated transition-colors text-left"
                        >
                          <Icon
                            size={16}
                            className="text-foreground-muted mt-0.5 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-foreground truncate">
                              {result.title}
                            </div>
                            <div className="text-xs text-foreground-secondary line-clamp-2 mt-0.5">
                              {highlightSnippet(result.snippet)}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  );
                })}

              {!query.trim() && !loading && (
                <div className="px-4 py-6 text-center text-sm text-foreground-muted">
                  Start typing to search across your notebook
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
