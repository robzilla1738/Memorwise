import { create } from 'zustand';
import type { Notebook, Source, Folder, Note, Tag } from '@/lib/types';

interface NotebookState {
  notebooks: Notebook[];
  selectedNotebookId: string | null;
  sources: Source[];
  folders: Folder[];
  notes: Note[];
  tags: Tag[];
  loading: boolean;
  viewingSource: Source | null;
  setViewingSource: (source: Source | null) => void;

  loadNotebooks: () => Promise<void>;
  createNotebook: (name: string) => Promise<Notebook>;
  deleteNotebook: (id: string) => Promise<void>;
  selectNotebook: (id: string | null) => Promise<void>;
  addSource: (files: FileList | File[]) => Promise<void>;
  addUrlSource: (url: string) => Promise<void>;
  deleteSource: (sourceId: string) => Promise<void>;
  refreshSources: () => Promise<void>;

  loadFolders: () => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<Folder>;
  deleteFolder: (id: string) => Promise<void>;

  loadNotes: () => Promise<void>;
  createNote: (title?: string) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;

  loadTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  moveSourceToFolder: (sourceId: string, folderId: string | null) => Promise<void>;
}

export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  selectedNotebookId: null,
  sources: [],
  folders: [],
  notes: [],
  tags: [],
  loading: false,
  viewingSource: null,
  setViewingSource: (source) => set({ viewingSource: source }),

  loadNotebooks: async () => {
    set({ loading: true });
    try {
      const res = await fetch('/api/notebooks');
      if (res.ok) set({ notebooks: await res.json() });
    } catch { /* network error */ }
    set({ loading: false });
  },

  createNotebook: async (name: string) => {
    const res = await fetch('/api/notebooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('Failed to create notebook');
    const notebook = await res.json();
    set(s => ({ notebooks: [notebook, ...s.notebooks] }));
    return notebook;
  },

  deleteNotebook: async (id: string) => {
    await fetch(`/api/notebooks/${id}`, { method: 'DELETE' });
    set(s => ({
      notebooks: s.notebooks.filter(n => n.id !== id),
      selectedNotebookId: s.selectedNotebookId === id ? null : s.selectedNotebookId,
      sources: s.selectedNotebookId === id ? [] : s.sources,
      folders: s.selectedNotebookId === id ? [] : s.folders,
      notes: s.selectedNotebookId === id ? [] : s.notes,
      tags: s.selectedNotebookId === id ? [] : s.tags,
    }));
  },

  selectNotebook: async (id: string | null) => {
    set({ selectedNotebookId: id, sources: [], folders: [], notes: [], tags: [] });
    if (id) {
      try {
        const [srcRes, folderRes, noteRes, tagRes] = await Promise.all([
          fetch(`/api/sources?notebookId=${id}`),
          fetch(`/api/folders?notebookId=${id}`),
          fetch(`/api/notes?notebookId=${id}`),
          fetch(`/api/tags?notebookId=${id}`),
        ]);
        set({
          sources: srcRes.ok ? await srcRes.json() : [],
          folders: folderRes.ok ? await folderRes.json() : [],
          notes: noteRes.ok ? await noteRes.json() : [],
          tags: tagRes.ok ? await tagRes.json() : [],
        });
      } catch { /* network error — keep empty arrays */ }
    }
  },

  addSource: async (files: FileList | File[]) => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) return;
    const formData = new FormData();
    formData.append('notebookId', selectedNotebookId);
    for (const file of Array.from(files)) formData.append('files', file);
    const res = await fetch('/api/sources', { method: 'POST', body: formData });
    if (!res.ok) return;
    const newSources = await res.json();
    set(s => ({ sources: [...newSources, ...s.sources] }));
  },

  addUrlSource: async (url: string) => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) return;
    const res = await fetch('/api/sources/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebookId: selectedNotebookId, url }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add URL');
    }
    const source = await res.json();
    set(s => ({ sources: [source, ...s.sources] }));
  },

  deleteSource: async (sourceId: string) => {
    await fetch(`/api/sources/${sourceId}`, { method: 'DELETE' });
    set(s => ({ sources: s.sources.filter(src => src.id !== sourceId) }));
  },

  refreshSources: async () => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) return;
    try {
      const res = await fetch(`/api/sources?notebookId=${selectedNotebookId}`);
      if (res.ok) set({ sources: await res.json() });
    } catch { /* network error */ }
  },

  // Folders
  loadFolders: async () => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) return;
    try {
      const res = await fetch(`/api/folders?notebookId=${selectedNotebookId}`);
      if (res.ok) set({ folders: await res.json() });
    } catch { /* network error */ }
  },

  createFolder: async (name: string, parentId?: string) => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) throw new Error('No notebook selected');
    const res = await fetch('/api/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebookId: selectedNotebookId, name, parentId }),
    });
    if (!res.ok) throw new Error('Failed to create folder');
    const folder = await res.json();
    set(s => ({ folders: [...s.folders, folder] }));
    return folder;
  },

  deleteFolder: async (id: string) => {
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    set(s => ({ folders: s.folders.filter(f => f.id !== id) }));
    get().refreshSources(); // Sources may have moved to root
  },

  moveSourceToFolder: async (sourceId: string, folderId: string | null) => {
    await fetch('/api/sources/move', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, folderId }),
    });
    set(s => ({
      sources: s.sources.map(src =>
        src.id === sourceId ? { ...src, folder_id: folderId } : src
      ),
    }));
  },

  // Notes
  loadNotes: async () => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) return;
    try {
      const res = await fetch(`/api/notes?notebookId=${selectedNotebookId}`);
      if (res.ok) set({ notes: await res.json() });
    } catch { /* network error */ }
  },

  createNote: async (title?: string) => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) throw new Error('No notebook selected');
    const res = await fetch('/api/notes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebookId: selectedNotebookId, title }),
    });
    if (!res.ok) throw new Error('Failed to create note');
    const note = await res.json();
    set(s => ({ notes: [note, ...s.notes] }));
    return note;
  },

  deleteNote: async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }));
  },

  // Tags
  loadTags: async () => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) return;
    try {
      const res = await fetch(`/api/tags?notebookId=${selectedNotebookId}`);
      if (res.ok) set({ tags: await res.json() });
    } catch { /* network error */ }
  },

  createTag: async (name: string, color?: string) => {
    const { selectedNotebookId } = get();
    if (!selectedNotebookId) throw new Error('No notebook selected');
    const res = await fetch('/api/tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notebookId: selectedNotebookId, name, color }),
    });
    if (!res.ok) throw new Error('Failed to create tag');
    const tag = await res.json();
    set(s => ({ tags: [...s.tags, tag] }));
    return tag;
  },

  deleteTag: async (id: string) => {
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    set(s => ({ tags: s.tags.filter(t => t.id !== id) }));
  },
}));
