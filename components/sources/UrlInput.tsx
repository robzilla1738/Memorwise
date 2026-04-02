'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Loader2, AlertCircle } from 'lucide-react';

function detectUrlType(url: string): 'youtube' | 'web' | null {
  if (!url.trim()) return null;
  try {
    const u = new URL(url);
    if (
      u.hostname.includes('youtube.com') ||
      u.hostname.includes('youtu.be')
    ) {
      return 'youtube';
    }
    return 'web';
  } catch {
    return null;
  }
}

export function UrlInput({
  notebookId,
  onSourceAdded,
}: {
  notebookId: string;
  onSourceAdded: () => void;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlType = detectUrlType(url);

  const handleSubmit = async () => {
    if (!url.trim() || !urlType) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sources/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, url: url.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add source');
      }

      setUrl('');
      onSourceAdded();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
            placeholder="Paste a URL (YouTube, web, article...)"
            disabled={loading}
            className="w-full px-2.5 py-1.5 pr-16 text-xs bg-input border border-border rounded-md text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          <AnimatePresence>
            {urlType && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                  urlType === 'youtube'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-green-500/20 text-green-400'
                }`}
              >
                {urlType === 'youtube' ? 'YouTube' : 'Web'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !urlType}
          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ArrowRight size={14} />
          )}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 text-[11px] text-error"
          >
            <AlertCircle size={12} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
