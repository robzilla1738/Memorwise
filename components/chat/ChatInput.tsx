'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  // Listen for prefill events from graph explore
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.text) {
        setValue(detail.text);
        setTimeout(() => textareaRef.current?.focus(), 100);
      }
    };
    window.addEventListener('memorwise:prefill-chat', handler);
    return () => window.removeEventListener('memorwise:prefill-chat', handler);
  }, []);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const hasText = value.trim().length > 0;

  return (
    <div>
      <div className="flex items-center bg-card border border-border rounded-xl px-4 py-3 focus-within:ring-1 focus-within:ring-ring transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Add sources to start chatting...' : 'Ask a question...'}
          disabled={disabled}
          rows={1}
          aria-label="Chat message input"
          className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-foreground-muted leading-normal max-h-[160px] disabled:opacity-50 overflow-hidden"
          style={{ scrollbarWidth: 'none' }}
        />
        <button
          onClick={handleSend}
          disabled={!hasText || disabled}
          className={`ml-3 p-1.5 rounded-lg flex-shrink-0 transition-colors ${
            hasText && !disabled
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-elevated text-foreground-muted'
          }`}
        >
          <ArrowUp size={16} />
        </button>
      </div>
      <p className="text-center text-[11px] text-foreground-muted mt-1.5">
        Enter to send &middot; Shift+Enter for new line
      </p>
    </div>
  );
}
