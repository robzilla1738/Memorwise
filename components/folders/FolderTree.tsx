'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronDown,
  Folder as FolderIcon,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  StickyNote,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
} from 'lucide-react';
import { toast } from '@/components/ui/Toast';
import { confirm as confirmDialog } from '@/components/ui/ConfirmDialog';
import type { Folder, Source, Note } from '@/lib/types';

function getFileIcon(filetype: string) {
  switch (filetype) {
    case 'pdf':
      return <FileText size={13} className="text-red-400" />;
    case 'csv':
    case 'xlsx':
    case 'xls':
      return <FileSpreadsheet size={13} className="text-green-400" />;
    case 'md':
    case 'txt':
      return <FileCode size={13} className="text-blue-400" />;
    case 'docx':
    case 'doc':
      return <FileText size={13} className="text-indigo-400" />;
    default:
      return <File size={13} className="text-foreground-secondary" />;
  }
}

interface FolderTreeProps {
  notebookId: string;
  folders: Folder[];
  sources: Source[];
  notes: Note[];
  onSelectFolder: (id: string | null) => void;
  selectedFolderId: string | null;
}

function FolderItem({
  folder,
  folders,
  sources,
  notes,
  depth,
  selectedFolderId,
  onSelectFolder,
  onDelete,
  onRename,
}: {
  folder: Folder;
  folders: Folder[];
  sources: Source[];
  notes: Note[];
  depth: number;
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState(folder.name);

  const children = folders.filter((f) => f.parent_id === folder.id);
  const folderSources = sources.filter((s) => s.folder_id === folder.id);
  const folderNotes = notes.filter((n) => n.folder_id === folder.id);
  const isSelected = selectedFolderId === folder.id;

  const handleRename = () => {
    if (renameName.trim() && renameName.trim() !== folder.name) {
      onRename(folder.id, renameName.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 px-1.5 py-1 rounded-md cursor-pointer text-xs transition-colors ${
          isSelected
            ? 'bg-elevated text-foreground'
            : 'text-foreground-secondary hover:bg-elevated hover:text-foreground'
        }`}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        onClick={() => onSelectFolder(folder.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="p-0.5 shrink-0"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {expanded ? (
          <FolderOpen size={13} className="text-accent-blue shrink-0" />
        ) : (
          <FolderIcon size={13} className="text-accent-blue shrink-0" />
        )}

        {isRenaming ? (
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="flex-1 px-1 py-0 text-xs bg-input border border-accent-blue rounded text-foreground"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1">{folder.name}</span>
        )}

        <div className="relative shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-elevated transition-all"
          >
            <MoreHorizontal size={12} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-md shadow-lg py-1 min-w-[100px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRenaming(true);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground-secondary hover:bg-elevated hover:text-foreground"
              >
                <Pencil size={11} />
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-error hover:bg-elevated"
              >
                <Trash2 size={11} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {children.map((child) => (
              <FolderItem
                key={child.id}
                folder={child}
                folders={folders}
                sources={sources}
                notes={notes}
                depth={depth + 1}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                onDelete={onDelete}
                onRename={onRename}
              />
            ))}
            {folderSources.map((src) => (
              <div
                key={src.id}
                className="flex items-center gap-2 px-2 py-1 text-[11px] text-foreground-secondary hover:bg-elevated rounded-md"
                style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}
              >
                {getFileIcon(src.filetype)}
                <span className="truncate">{src.filename}</span>
              </div>
            ))}
            {folderNotes.map((note) => (
              <div
                key={note.id}
                className="flex items-center gap-2 px-2 py-1 text-[11px] text-foreground-secondary hover:bg-elevated rounded-md"
                style={{ paddingLeft: `${(depth + 1) * 12 + 18}px` }}
              >
                <StickyNote size={13} className="text-indigo-400" />
                <span className="truncate">{note.title || 'Untitled'}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FolderTree({
  notebookId,
  folders,
  sources,
  notes,
  onSelectFolder,
  selectedFolderId,
}: FolderTreeProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const rootFolders = folders.filter((f) => !f.parent_id);
  const rootSources = sources.filter((s) => !s.folder_id);
  const rootNotes = notes.filter((n) => !n.folder_id);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setNewFolderName('');
      return;
    }

    try {
      await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          name,
          parentId: selectedFolderId,
        }),
      });
      toast('success', `Folder "${name}" created`);
    } catch (err) {
      toast('error', 'Failed to create folder');
      console.error('Failed to create folder:', err);
    }

    setCreatingFolder(false);
    setNewFolderName('');
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    const ok = await confirmDialog({
      title: 'Delete folder',
      message: `"${folder?.name || 'Folder'}" and its contents will be permanently deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      toast('success', 'Folder deleted');
    } catch (err) {
      toast('error', 'Failed to delete folder');
      console.error('Failed to delete folder:', err);
    }
  };

  const handleRenameFolder = async (folderId: string, name: string) => {
    try {
      await fetch(`/api/folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
    } catch (err) {
      toast('error', 'Failed to rename folder');
      console.error('Failed to rename folder:', err);
    }
  };

  return (
    <div className="space-y-0.5">
      {/* All files root */}
      <div
        onClick={() => onSelectFolder(null)}
        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors ${
          selectedFolderId === null
            ? 'bg-elevated text-foreground'
            : 'text-foreground-secondary hover:bg-elevated hover:text-foreground'
        }`}
      >
        <FolderIcon size={13} className="text-foreground-muted" />
        <span>All files</span>
      </div>

      {/* Folder tree */}
      {rootFolders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          folders={folders}
          sources={sources}
          notes={notes}
          depth={0}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          onDelete={handleDeleteFolder}
          onRename={handleRenameFolder}
        />
      ))}

      {/* Root-level sources */}
      {rootSources.map((src) => (
        <div
          key={src.id}
          className="flex items-center gap-2 px-2 py-1 text-[11px] text-foreground-secondary hover:bg-elevated rounded-md"
          style={{ paddingLeft: '18px' }}
        >
          {getFileIcon(src.filetype)}
          <span className="truncate">{src.filename}</span>
        </div>
      ))}

      {/* Root-level notes */}
      {rootNotes.map((note) => (
        <div
          key={note.id}
          className="flex items-center gap-2 px-2 py-1 text-[11px] text-foreground-secondary hover:bg-elevated rounded-md"
          style={{ paddingLeft: '18px' }}
        >
          <StickyNote size={13} className="text-indigo-400" />
          <span className="truncate">{note.title || 'Untitled'}</span>
        </div>
      ))}

      {/* New folder input */}
      {creatingFolder && (
        <div className="px-2 py-1">
          <input
            autoFocus
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') {
                setCreatingFolder(false);
                setNewFolderName('');
              }
            }}
            onBlur={handleCreateFolder}
            placeholder="Folder name..."
            className="w-full px-2 py-1 text-xs bg-input border border-border rounded-md text-foreground placeholder:text-foreground-muted focus:border-accent-blue focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* New folder button */}
      <button
        onClick={() => setCreatingFolder(true)}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-foreground-muted hover:text-foreground-secondary hover:bg-elevated rounded-md transition-colors"
      >
        <Plus size={12} />
        New folder
      </button>
    </div>
  );
}
