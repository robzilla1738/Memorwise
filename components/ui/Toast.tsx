'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

let addToastFn: ((type: Toast['type'], message: string) => void) | null = null;

export function toast(type: Toast['type'], message: string) {
  addToastFn?.(type, message);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => { addToastFn = null; };
  }, [addToast]);

  const icons = { success: CheckCircle2, error: XCircle, info: Info };
  const colors = {
    success: 'bg-success/10 border-success/20 text-success',
    error: 'bg-error/10 border-error/20 text-error',
    info: 'bg-accent-blue/10 border-accent-blue/20 text-accent-blue',
  };

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border text-[13px] shadow-lg ${colors[t.type]}`}>
              <Icon size={14} className="shrink-0" />
              <span>{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="ml-2 p-0.5 rounded hover:bg-black/10 shrink-0">
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
