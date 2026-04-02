'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, FileText, StickyNote, GitBranch } from 'lucide-react';
import { MarkdownRenderer } from '@/components/chat/MarkdownRenderer';
import { toast } from '@/components/ui/Toast';
import type { Message } from '@/lib/types';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  onFork?: (messageId: string) => void;
}

export function ChatMessage({ message, isStreaming, onFork }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState<'text' | 'md' | null>(null);
  const [savedToNote, setSavedToNote] = useState(false);

  const handleCopy = async (format: 'text' | 'md') => {
    const text = format === 'md' ? message.content : message.content.replace(/[#*`_~\[\]]/g, '');
    await navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveToNote = async () => {
    try {
      const { useNotebookStore } = await import('@/stores/notebook-store');
      const notebookId = useNotebookStore.getState().selectedNotebookId;
      if (!notebookId) { toast('error', 'No notebook selected'); return; }

      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          title: message.content.slice(0, 50).replace(/[#*`\n]/g, '').trim() || 'Chat Export',
          content: message.content,
        }),
      });
      setSavedToNote(true);
      toast('success', 'Saved to notes');
      setTimeout(() => setSavedToNote(false), 2000);
    } catch {
      toast('error', 'Failed to save note');
    }
  };

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
        className="flex justify-end"
      >
        <div className="max-w-[80%] px-4 py-2.5 bg-elevated rounded-2xl rounded-br-md">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </motion.div>
    );
  }

  // AI message
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="group"
    >
      {/* AI label */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <img src="/logo-mark.png" alt="" className="w-[22px] h-[22px] object-contain logo-adaptive opacity-60" />
        <span className="text-[12px] font-medium text-foreground-muted">Memorwise</span>
      </div>

      {/* Content */}
      <div className="pl-5">
        {message.content ? (
          <div className="markdown-body">
            <MarkdownRenderer content={message.content} />
            {isStreaming && (
              <span className="inline-block w-[2px] h-4 bg-foreground-muted ml-0.5 cursor-blink" />
            )}
          </div>
        ) : isStreaming ? (
          <div className="flex gap-1.5 py-2">
            <span className="w-1.5 h-1.5 bg-foreground-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-foreground-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-foreground-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : null}

        {/* Citations — deduplicated by source */}
        {message.citations && message.citations.length > 0 && (() => {
          const seen = new Map<string, { filename: string; count: number; preview: string }>();
          for (const cite of message.citations) {
            const existing = seen.get(cite.filename);
            if (existing) { existing.count++; }
            else { seen.set(cite.filename, { filename: cite.filename, count: 1, preview: cite.chunk_text?.slice(0, 200) || '' }); }
          }
          return (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {Array.from(seen.values()).map((src, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-elevated border border-border rounded-lg text-[12px] text-foreground-secondary hover:bg-card-hover transition-colors cursor-default"
                  title={src.preview}
                >
                  <FileText size={12} className="text-foreground-muted" />
                  {src.filename}
                  {src.count > 1 && <span className="text-[10px] text-foreground-muted">({src.count} chunks)</span>}
                </span>
              ))}
            </div>
          );
        })()}

        {/* Action bar — visible on hover */}
        {message.content && !isStreaming && (
          <div className="flex items-center gap-1 mt-2 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              onClick={() => handleCopy('text')}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-foreground-muted hover:text-foreground-secondary hover:bg-elevated rounded-md transition-colors"
              title="Copy as plain text"
            >
              {copied === 'text' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              {copied === 'text' ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={() => handleCopy('md')}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-foreground-muted hover:text-foreground-secondary hover:bg-elevated rounded-md transition-colors"
              title="Copy as markdown"
            >
              {copied === 'md' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
              {copied === 'md' ? 'Copied!' : 'Markdown'}
            </button>
            <button
              onClick={handleSaveToNote}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-foreground-muted hover:text-foreground-secondary hover:bg-elevated rounded-md transition-colors"
              title="Save to notes"
            >
              {savedToNote ? <Check size={12} className="text-success" /> : <StickyNote size={12} />}
              {savedToNote ? 'Saved!' : 'Save to Note'}
            </button>
            {onFork && (
              <button
                onClick={() => onFork(message.id)}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-foreground-muted hover:text-foreground-secondary hover:bg-elevated rounded-md transition-colors"
                title="Fork conversation from here"
              >
                <GitBranch size={12} />
                Fork
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
