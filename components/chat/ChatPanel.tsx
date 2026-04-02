'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  FileUp,
  X,
  Loader2,
  Plus,
  Focus,
} from 'lucide-react';
import { useChatStore } from '@/stores/chat-store';
import { useNotebookStore } from '@/stores/notebook-store';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';

export function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    messages,
    streamingContent,
    contextMeta,
    isStreaming,
    error,
    clearError,
    sendMessage,
    selectSession,
    createSession,
    deleteSession,
    forkSession,
    focusedSourceId,
    setFocusedSource,
  } = useChatStore();
  const { selectedNotebookId, sources } = useNotebookStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const hasSources = sources.some((s) => s.status === 'ready' || s.status === 'error');

  // Load suggested questions when chat is empty and sources are ready
  useEffect(() => {
    if (
      hasSources &&
      messages.length === 0 &&
      selectedNotebookId &&
      !loadingSuggestions &&
      suggestions.length === 0
    ) {
      setLoadingSuggestions(true);
      fetch(`/api/generate/suggestions?notebookId=${selectedNotebookId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setSuggestions(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoadingSuggestions(false));
    }
  }, [hasSources, messages.length, selectedNotebookId]);

  // Clear suggestions when notebook changes
  useEffect(() => {
    setSuggestions([]);
  }, [selectedNotebookId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  const handleSend = (text: string) => {
    if (!selectedNotebookId || !activeSessionId) return;
    sendMessage(selectedNotebookId, text);
    setSuggestions([]);
  };

  const handleSuggestionClick = (q: string) => {
    handleSend(q);
  };

  const handleFork = (messageId: string) => {
    if (!selectedNotebookId || !activeSessionId) return;
    forkSession(activeSessionId, selectedNotebookId, messageId);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Session tabs */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border overflow-x-auto">
          <AnimatePresence mode="popLayout">
            {sessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <motion.button
                  key={session.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => selectSession(session.id)}
                  className={`group flex items-center gap-2 px-3 py-1.5 text-[13px] rounded-md whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-elevated text-foreground'
                      : 'text-foreground-secondary hover:text-foreground hover:bg-elevated/50'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span className="max-w-[100px] truncate">
                    {session.title || 'New Chat'}
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedNotebookId)
                        deleteSession(session.id, selectedNotebookId);
                    }}
                    className={`p-0.5 rounded hover:bg-border-subtle transition-colors ${
                      isActive
                        ? 'text-foreground-muted hover:text-foreground-secondary'
                        : 'opacity-0 group-hover:opacity-100 text-foreground-muted hover:text-foreground-secondary'
                    }`}
                  >
                    <X size={12} />
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
          <button
            onClick={() => selectedNotebookId && createSession(selectedNotebookId)}
            className="flex items-center gap-1 px-2 py-1 text-[12px] text-foreground-muted hover:text-foreground-secondary hover:bg-elevated rounded-md transition-colors shrink-0 ml-auto"
            title="New chat session"
          >
            <Plus size={12} />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-2 px-4 py-2.5 bg-error/10 border border-error/20 rounded-lg flex items-center justify-between text-[13px]">
          <span className="text-error">{error}</span>
          <button
            onClick={clearError}
            className="p-0.5 hover:bg-error/10 rounded"
          >
            <X size={14} className="text-error" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              {hasSources ? (
                <>
                  <MessageSquare
                    size={32}
                    className="mx-auto mb-3 text-foreground-muted"
                  />
                  <p className="text-sm text-foreground-secondary mb-4">
                    Ask a question about your documents
                  </p>

                  {loadingSuggestions && (
                    <div className="flex items-center justify-center gap-2 text-[13px] text-foreground-muted">
                      <Loader2 size={14} className="animate-spin" />
                      Generating suggestions...
                    </div>
                  )}
                  {suggestions.length > 0 && (
                    <div className="mt-6 w-full max-w-sm mx-auto">
                      <p className="text-[11px] text-foreground-muted uppercase tracking-widest flex items-center justify-center gap-2 mb-3">
                        <img src="/logo-mark.png" alt="" className="w-3 h-3 logo-adaptive opacity-50" /> Suggested questions
                      </p>
                      <div className="flex flex-col gap-2">
                        {suggestions.map((q, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            onClick={() => handleSuggestionClick(q)}
                            className="w-full px-4 py-3 bg-card hover:bg-elevated border border-border hover:border-border-subtle rounded-xl text-sm text-foreground-secondary hover:text-foreground text-left transition-colors"
                          >
                            {q}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <FileUp
                    size={32}
                    className="mx-auto mb-3 text-foreground-muted"
                  />
                  <p className="text-sm text-foreground-secondary">
                    Add sources to get started
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onFork={msg.role === 'assistant' ? handleFork : undefined} />
            ))}
            {isStreaming && (
              <ChatMessage
                message={{
                  id: 'streaming',
                  session_id: activeSessionId || '',
                  role: 'assistant',
                  content: streamingContent,
                  citations: null,
                  created_at: new Date().toISOString(),
                }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Source focus + Context indicator + Input */}
      <div className="px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          {/* Source focus selector */}
          {hasSources && (
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <button
                onClick={() => setFocusedSource(null)}
                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors ${
                  !focusedSourceId ? 'bg-accent-blue/10 border-accent-blue/20 text-accent-blue' : 'border-border text-foreground-muted hover:text-foreground-secondary hover:border-border-hover'
                }`}
              >
                All sources
              </button>
              {sources.filter(s => s.status === 'ready').map(src => (
                <button
                  key={src.id}
                  onClick={() => setFocusedSource(focusedSourceId === src.id ? null : src.id)}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md border transition-colors truncate max-w-[140px] ${
                    focusedSourceId === src.id ? 'bg-accent-blue/10 border-accent-blue/20 text-accent-blue' : 'border-border text-foreground-muted hover:text-foreground-secondary hover:border-border-hover'
                  }`}
                  title={`Chat with ${src.filename} only`}
                >
                  {focusedSourceId === src.id && <Focus size={10} className="shrink-0" />}
                  <span className="truncate">{src.filename}</span>
                </button>
              ))}
            </div>
          )}
          {contextMeta && contextMeta.chunksUsed > 0 && (
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-foreground-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
              Using {contextMeta.chunksUsed} of {contextMeta.totalChunks} chunks
              {focusedSourceId ? ` from "${sources.find(s => s.id === focusedSourceId)?.filename || 'selected source'}"` : ` from ${contextMeta.sourcesUsed} source${contextMeta.sourcesUsed !== 1 ? 's' : ''}`}
            </div>
          )}
          <ChatInput onSend={handleSend} disabled={isStreaming || !hasSources} />
        </div>
      </div>
    </div>
  );
}
