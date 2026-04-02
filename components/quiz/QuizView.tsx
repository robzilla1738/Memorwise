'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export function QuizView({ notebookId }: { notebookId: string }) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generated, setGenerated] = useState(false);

  // Listen for saved quiz data from Studio panel
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type === 'quiz' && Array.isArray(detail.data)) {
        setQuestions(detail.data);
        setCurrent(0); setSelected(null); setAnswered(false); setScore(0); setFinished(false);
        setGenerated(true);
      }
    };
    window.addEventListener('memorwise:load-generation', handler);
    return () => window.removeEventListener('memorwise:load-generation', handler);
  }, []);

  const generate = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/generate/quiz', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Failed'); }
      const data = await res.json();
      setQuestions(data);
      setCurrent(0); setSelected(null); setAnswered(false); setScore(0); setFinished(false);
      setGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally { setLoading(false); }
  };

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
  };

  const handleSubmit = () => {
    if (selected === null) return;
    setAnswered(true);
    if (selected === questions[current].correctIndex) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (current + 1 >= questions.length) { setFinished(true); return; }
    setCurrent(c => c + 1); setSelected(null); setAnswered(false);
  };

  if (!generated) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-foreground-secondary mb-3">Test your knowledge with a quiz</p>
          <button onClick={generate} disabled={loading}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 text-sm rounded-lg disabled:opacity-50 flex items-center gap-2 mx-auto">
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Generating...' : 'Generate Quiz'}
          </button>
          {error && <p className="text-[13px] text-destructive mt-2">{error}</p>}
        </div>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <Trophy size={40} className={`mx-auto mb-3 ${pct >= 70 ? 'text-warning' : 'text-foreground-muted'}`} />
          <h3 className="text-lg font-semibold text-foreground mb-1">Quiz Complete!</h3>
          <p className="text-2xl font-bold text-foreground mb-1">{score}/{questions.length}</p>
          <p className="text-sm text-foreground-secondary mb-4">{pct}% correct</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => { setCurrent(0); setSelected(null); setAnswered(false); setScore(0); setFinished(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-elevated text-foreground-secondary rounded-lg hover:text-foreground">
              <RotateCcw size={14} /> Retry
            </button>
            <button onClick={generate} disabled={loading}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
              New Quiz
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Progress bar */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] text-foreground-secondary">Question {current + 1} of {questions.length}</span>
          <span className="text-[13px] text-foreground-muted">Score: {score}/{current + (answered ? 1 : 0)}</span>
        </div>
        <div className="h-1 bg-elevated rounded-full overflow-hidden">
          <div className="h-full bg-accent-blue rounded-full transition-all" style={{ width: `${((current + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h3 className="text-base font-medium text-foreground mb-4 leading-relaxed">{q.question}</h3>

              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const isCorrect = i === q.correctIndex;
                  const isSelected = i === selected;
                  let style = 'border-border hover:border-border-subtle hover:bg-elevated';
                  if (answered) {
                    if (isCorrect) style = 'border-success bg-success/10';
                    else if (isSelected && !isCorrect) style = 'border-destructive bg-destructive/10';
                    else style = 'border-border opacity-50';
                  } else if (isSelected) {
                    style = 'border-accent-blue bg-accent-blue/5';
                  }

                  return (
                    <button key={i} onClick={() => handleSelect(i)} disabled={answered}
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl text-left transition-colors ${style}`}>
                      <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[12px] font-medium shrink-0 ${
                        answered && isCorrect ? 'border-success text-success bg-success/20' :
                        answered && isSelected && !isCorrect ? 'border-destructive text-destructive bg-destructive/20' :
                        isSelected ? 'border-accent-blue text-accent-blue bg-accent-blue/20' :
                        'border-border text-foreground-muted'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm text-foreground">{opt}</span>
                      {answered && isCorrect && <CheckCircle2 size={16} className="ml-auto text-success" />}
                      {answered && isSelected && !isCorrect && <XCircle size={16} className="ml-auto text-destructive" />}
                    </button>
                  );
                })}
              </div>

              {/* Explanation */}
              {answered && q.explanation && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-elevated rounded-lg text-[13px] text-foreground-secondary leading-relaxed">
                  <strong className="text-foreground">Explanation:</strong> {q.explanation}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4">
        <div className="max-w-2xl mx-auto flex justify-end gap-2">
          {!answered ? (
            <button onClick={handleSubmit} disabled={selected === null}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 disabled:opacity-40">
              Check Answer
            </button>
          ) : (
            <button onClick={handleNext}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90">
              {current + 1 >= questions.length ? 'See Results' : 'Next Question'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
