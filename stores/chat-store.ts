import { create } from 'zustand';
import type { ChatSession, Message, Citation } from '@/lib/types';

interface ContextMeta {
  chunksUsed: number;
  totalChunks: number;
  sourcesUsed: number;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
  error: string | null;
  contextMeta: ContextMeta | null;
  recommendation: string | null;

  loadSessions: (notebookId: string) => Promise<void>;
  createSession: (notebookId: string) => Promise<ChatSession>;
  deleteSession: (sessionId: string, notebookId: string) => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  forkSession: (sessionId: string, notebookId: string, upToMessageId: string) => Promise<void>;
  focusedSourceId: string | null;
  setFocusedSource: (sourceId: string | null) => void;
  sendMessage: (notebookId: string, message: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  streamingContent: '',
  contextMeta: null,
  recommendation: null,
  focusedSourceId: null,
  isStreaming: false,
  error: null,

  setFocusedSource: (sourceId: string | null) => set({ focusedSourceId: sourceId }),

  loadSessions: async (notebookId: string) => {
    const res = await fetch(`/api/chat/sessions?notebookId=${notebookId}`);
    const sessions = await res.json();
    set({ sessions, error: null });
    if (sessions.length === 0) {
      const r = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebookId }) });
      const session = await r.json();
      set({ sessions: [session], activeSessionId: session.id, messages: [] });
    } else {
      set({ activeSessionId: sessions[0].id });
      const r = await fetch(`/api/chat/sessions/${sessions[0].id}`);
      set({ messages: await r.json() });
    }
  },

  createSession: async (notebookId: string) => {
    const res = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebookId }) });
    const session = await res.json();
    set(s => ({ sessions: [session, ...s.sessions], activeSessionId: session.id, messages: [], error: null }));
    return session;
  },

  deleteSession: async (sessionId: string, notebookId: string) => {
    await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
    const remaining = get().sessions.filter(s => s.id !== sessionId);
    set({ sessions: remaining });
    if (get().activeSessionId === sessionId) {
      if (remaining.length > 0) {
        set({ activeSessionId: remaining[0].id });
        const r = await fetch(`/api/chat/sessions/${remaining[0].id}`);
        set({ messages: await r.json() });
      } else {
        const r = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notebookId }) });
        const session = await r.json();
        set({ sessions: [session], activeSessionId: session.id, messages: [] });
      }
    }
  },

  selectSession: async (sessionId: string) => {
    set({ activeSessionId: sessionId, messages: [], error: null, contextMeta: null });
    const res = await fetch(`/api/chat/sessions/${sessionId}`);
    set({ messages: await res.json() });
  },

  forkSession: async (sessionId: string, notebookId: string, upToMessageId: string) => {
    const res = await fetch('/api/chat/sessions/fork', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, notebookId, upToMessageId }),
    });
    if (!res.ok) return;
    const newSession = await res.json();
    set(s => ({ sessions: [newSession, ...s.sessions], activeSessionId: newSession.id }));
    const msgRes = await fetch(`/api/chat/sessions/${newSession.id}`);
    set({ messages: await msgRes.json() });
  },

  sendMessage: async (notebookId: string, message: string) => {
    const { activeSessionId, isStreaming, focusedSourceId } = get();
    if (!activeSessionId || isStreaming) return;

    const userMsg: Message = { id: `temp-${Date.now()}`, session_id: activeSessionId, role: 'user', content: message, citations: null, created_at: new Date().toISOString() };
    set(s => ({ messages: [...s.messages, userMsg], streamingContent: '', isStreaming: true, error: null, contextMeta: null }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, notebookId, message, sourceId: focusedSourceId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Chat request failed' }));
        throw new Error(err.error || `Chat failed: ${res.status}`);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === 'context') {
              set({ contextMeta: { chunksUsed: event.chunksUsed, totalChunks: event.totalChunks, sourcesUsed: event.sourcesUsed } });
            } else if (event.type === 'token') {
              streamContent += event.content;
              set({ streamingContent: streamContent });
            } else if (event.type === 'done') {
              const assistantMsg: Message = {
                id: event.messageId, session_id: activeSessionId, role: 'assistant',
                content: event.fullText, citations: event.citations || null, created_at: new Date().toISOString(),
              };
              set(s => ({ messages: [...s.messages, assistantMsg], streamingContent: '', isStreaming: false }));
              // Refresh sessions to get updated title
              const sessRes = await fetch(`/api/chat/sessions?notebookId=${notebookId}`);
              set({ sessions: await sessRes.json() });
            } else if (event.type === 'recommendation') {
              set({ recommendation: event.topic });
            } else if (event.type === 'error') {
              set({ streamingContent: '', isStreaming: false, error: event.message });
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      set({ isStreaming: false, streamingContent: '', error: err instanceof Error ? err.message : 'Failed to send' });
    }
  },

  clearError: () => set({ error: null }),
}));
