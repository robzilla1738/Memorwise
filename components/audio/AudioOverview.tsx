'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Headphones, Loader2, AlertCircle, X } from 'lucide-react';

interface AudioOverviewProps {
  notebookId: string;
}

interface ScriptLine {
  speaker: string;
  text: string;
}

type Status = 'idle' | 'generating-script' | 'script-ready' | 'generating-audio' | 'audio-ready' | 'error';
type PodcastLength = 'short' | 'medium' | 'long';

function parseScript(raw: string): ScriptLine[] {
  const lines: ScriptLine[] = [];
  const regex = /^(Alex|Sam|Jordan|Riley):\s*(.+)/gm;
  let match;
  while ((match = regex.exec(raw)) !== null) {
    lines.push({ speaker: match[1], text: match[2].trim() });
  }
  return lines;
}

function createAudioUrl(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

export function AudioOverview({ notebookId }: AudioOverviewProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [podcastLength, setPodcastLength] = useState<PodcastLength>('medium');
  const [script, setScript] = useState<string>('');
  const [parsedLines, setParsedLines] = useState<ScriptLine[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const audioUrlRef = useRef<string | null>(null);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  const generate = useCallback(async () => {
    setStatus('generating-script');
    setErrorMsg('');
    setScript('');
    setParsedLines([]);
    setAudioUrl(null);

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    try {
      const res = await fetch('/api/generate/audio-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, speakerCount: (await import('@/stores/settings-store')).useSettingsStore.getState().podcastSpeakers, length: podcastLength }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate audio overview');
      }

      const data = await res.json();
      const rawScript = data.script || '';
      const lines = parseScript(rawScript);

      setScript(rawScript);
      setParsedLines(lines);

      if (data.audioBase64) {
        const url = createAudioUrl(data.audioBase64);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setStatus('audio-ready');
      } else {
        setStatus('script-ready');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Generation failed');
      setStatus('error');
    }
  }, [notebookId]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <AnimatePresence mode="wait">
        {/* Idle state */}
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <div className="w-10 h-10 rounded-full bg-elevated flex items-center justify-center">
              <Headphones size={20} className="text-foreground-muted" />
            </div>
            <p className="text-[13px] text-foreground-muted text-center">
              Generate a podcast-style audio overview
            </p>
            <div className="flex gap-1.5 w-full">
              {([
                { id: 'short' as PodcastLength, label: '~5 min', desc: 'Quick overview' },
                { id: 'medium' as PodcastLength, label: '~10 min', desc: 'Detailed' },
                { id: 'long' as PodcastLength, label: '~15 min', desc: 'Deep dive' },
              ]).map(l => (
                <button key={l.id} onClick={() => setPodcastLength(l.id)}
                  className={`flex-1 py-2 rounded-lg border text-center transition-colors ${
                    podcastLength === l.id ? 'border-accent-blue bg-accent-blue/5' : 'border-border hover:border-border-hover'
                  }`}>
                  <div className="text-[12px] font-medium text-foreground">{l.label}</div>
                  <div className="text-[10px] text-foreground-muted">{l.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={generate}
              className="w-full px-4 py-2.5 text-[13px] font-medium rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 transition-colors"
            >
              Generate Audio Overview
            </button>
          </motion.div>
        )}

        {/* Generating */}
        {status === 'generating-script' && (
          <motion.div
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <Loader2 size={24} className="animate-spin text-accent-blue" />
            <p className="text-[13px] text-foreground-muted">Creating your podcast...</p>
            <p className="text-[11px] text-foreground-muted/60">This may take a few minutes depending on length and model</p>
          </motion.div>
        )}

        {/* Error state */}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle size={20} className="text-destructive" />
            </div>
            <p className="text-[13px] text-destructive text-center px-2">{errorMsg}</p>
            <button
              onClick={generate}
              className="px-4 py-2 text-[13px] font-medium rounded-lg bg-zinc-800 text-foreground-secondary hover:bg-zinc-700 transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        )}

        {/* Script ready (no audio) or Audio ready */}
        {(status === 'script-ready' || status === 'audio-ready') && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-3"
          >
            {/* Audio player */}
            {status === 'audio-ready' && audioUrl && (
              <div className="rounded-lg bg-zinc-800/60 p-2.5">
                <audio
                  controls
                  src={audioUrl}
                  className="w-full h-8 [&::-webkit-media-controls-panel]:bg-zinc-700 [&::-webkit-media-controls-panel]:rounded-md"
                  style={{ colorScheme: 'dark' }}
                />
              </div>
            )}

            {/* Script-only note */}
            {status === 'script-ready' && (
              <div className="text-[11px] text-foreground-muted/70 bg-zinc-800/40 rounded-md px-2.5 py-2 text-center">
                Script only -- add an OpenAI key in Settings for audio playback
              </div>
            )}

            {/* Script display */}
            <div className="max-h-[320px] overflow-y-auto rounded-lg bg-elevated p-3 space-y-2.5 scrollbar-thin">
              {parsedLines.length > 0 ? (
                parsedLines.map((line, i) => (
                  <div
                    key={i}
                    className={`flex flex-col gap-0.5 ${
                      line.speaker === 'Sam' ? 'pl-3' : ''
                    }`}
                  >
                    <span
                      className={`text-[11px] font-semibold ${
                        line.speaker === 'Alex'
                          ? 'text-accent-blue'
                          : 'text-emerald-400'
                      }`}
                    >
                      {line.speaker}
                    </span>
                    <p className="text-[12px] text-foreground-secondary leading-relaxed">
                      {line.text}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-foreground-muted whitespace-pre-wrap">
                  {script}
                </p>
              )}
            </div>

            {/* Regenerate */}
            <button
              onClick={generate}
              className="self-center px-3 py-1.5 text-[12px] rounded-md bg-zinc-800 text-foreground-muted hover:text-foreground-secondary hover:bg-zinc-700 transition-colors"
            >
              Regenerate
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
