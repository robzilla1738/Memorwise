'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Loader2 } from 'lucide-react';

interface Flashcard {
  front: string;
  back: string;
}

export function FlashcardView({ notebookId }: { notebookId: string }) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  // Listen for saved flashcard data from Studio panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'flashcards' && Array.isArray(detail.data)) {
        setCards(detail.data);
        setCurrent(0); setFlipped(false);
        setGenerated(true);
      }
    };
    window.addEventListener('memorwise:load-generation', handler);
    return () => window.removeEventListener('memorwise:load-generation', handler);
  }, []);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setCards(data);
      setCurrent(0);
      setFlipped(false);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate flashcards');
    } finally {
      setLoading(false);
    }
  };

  if (!generated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-foreground-secondary mb-3">Generate flashcards from your sources</p>
          <button onClick={generate} disabled={loading}
            className="px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm rounded-lg disabled:opacity-50 flex items-center gap-2 mx-auto">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Generating...' : 'Generate Flashcards'}
          </button>
          {error && <p className="text-[13px] text-error mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return <div className="flex-1 flex items-center justify-center text-sm text-foreground-muted">No flashcards generated</div>;
  }

  const card = cards[current];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg">
        {/* Counter */}
        <div className="text-center mb-4">
          <span className="text-[13px] text-foreground-muted">{current + 1} / {cards.length}</span>
        </div>

        {/* Card */}
        <div className="relative cursor-pointer" style={{ perspective: 1000 }} onClick={() => setFlipped(!flipped)}>
          <AnimatePresence mode="wait">
            <motion.div
              key={flipped ? 'back' : 'front'}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className={`w-full min-h-[220px] rounded-xl border p-8 flex items-center justify-center text-center ${
                flipped
                  ? 'bg-accent-blue/5 border-accent-blue/20'
                  : 'bg-card border-border'
              }`}
            >
              <div>
                <div className="text-[11px] uppercase tracking-widest text-foreground-muted mb-3">
                  {flipped ? 'Answer' : 'Question'}
                </div>
                <p className={`text-[15px] leading-relaxed ${flipped ? 'text-foreground' : 'text-foreground font-medium'}`}>
                  {flipped ? card.back : card.front}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="text-[11px] text-foreground-muted text-center mt-2">Click card to flip</p>

        {/* Navigation */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button onClick={() => { setCurrent(Math.max(0, current - 1)); setFlipped(false); }}
            disabled={current === 0}
            className="p-2 rounded-lg bg-elevated text-foreground-secondary hover:text-foreground disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => { setCurrent(Math.min(cards.length - 1, current + 1)); setFlipped(false); }}
            disabled={current === cards.length - 1}
            className="p-2 rounded-lg bg-elevated text-foreground-secondary hover:text-foreground disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => { setCurrent(0); setFlipped(false); }}
            className="p-2 rounded-lg bg-elevated text-foreground-secondary hover:text-foreground ml-2" title="Restart">
            <RotateCcw size={16} />
          </button>
          <button onClick={generate} disabled={loading}
            className="px-3 py-1.5 text-[13px] text-foreground-secondary hover:text-foreground bg-elevated rounded-lg ml-2">
            {loading ? 'Regenerating...' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
