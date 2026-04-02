'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

let showConfirmFn: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  if (!showConfirmFn) return Promise.resolve(true);
  return showConfirmFn(opts);
}

export function ConfirmDialogProvider() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const show = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>(resolve => { resolveRef.current = resolve; });
  }, []);

  useEffect(() => {
    showConfirmFn = show;
    return () => { showConfirmFn = null; };
  }, [show]);

  useEffect(() => {
    if (open) confirmBtnRef.current?.focus();
  }, [open]);

  const resolve = (value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolve(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <AnimatePresence>
      {open && opts && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => resolve(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.12 }}
            className="fixed inset-0 flex items-center justify-center z-[61] p-4">
            <div className="w-[380px] bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${opts.destructive ? 'bg-error/10' : 'bg-accent-blue/10'}`}>
                    <AlertTriangle size={16} className={opts.destructive ? 'text-error' : 'text-accent-blue'} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">{opts.title}</h3>
                    <p className="text-[13px] text-foreground-secondary mt-1">{opts.message}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-elevated/50">
                <button onClick={() => resolve(false)}
                  className="px-3 py-1.5 text-[13px] text-foreground-secondary hover:text-foreground rounded-lg hover:bg-elevated transition-colors">
                  Cancel
                </button>
                <button ref={confirmBtnRef} onClick={() => resolve(true)}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                    opts.destructive
                      ? 'bg-error text-white hover:bg-error/90'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}>
                  {opts.confirmLabel || 'Confirm'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
