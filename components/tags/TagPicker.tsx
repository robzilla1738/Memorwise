'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ChevronDown, Loader2 } from 'lucide-react';
import type { Tag } from '@/lib/types';

export function TagPicker({
  notebookId,
  targetId,
  targetType,
}: {
  notebookId: string;
  targetId: string;
  targetType: 'source' | 'note';
}) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [assignedTagIds, setAssignedTagIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [creating, setCreating] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch all tags and assigned tags
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [tagsRes, assignedRes] = await Promise.all([
          fetch(`/api/tags?notebookId=${notebookId}`),
          fetch(
            `/api/tags/assign?targetId=${targetId}&targetType=${targetType}`
          ),
        ]);

        if (tagsRes.ok) {
          const tags = await tagsRes.json();
          setAllTags(tags);
        }
        if (assignedRes.ok) {
          const assigned = await assignedRes.json();
          setAssignedTagIds(
            new Set(
              (assigned as { tag_id: string }[]).map((a) => a.tag_id)
            )
          );
        }
      } catch (err) {
        console.error('Tag load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [notebookId, targetId, targetType]);

  const assignedTags = allTags.filter((t) => assignedTagIds.has(t.id));
  const unassignedTags = allTags.filter((t) => !assignedTagIds.has(t.id));

  const handleAssign = async (tagId: string) => {
    try {
      await fetch('/api/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId, targetId, targetType }),
      });
      setAssignedTagIds((prev) => new Set([...prev, tagId]));
    } catch (err) {
      console.error('Assign error:', err);
    }
  };

  const handleUnassign = async (tagId: string) => {
    try {
      await fetch(
        `/api/tags/assign?tagId=${tagId}&targetId=${targetId}&targetType=${targetType}`,
        { method: 'DELETE' }
      );
      setAssignedTagIds((prev) => {
        const next = new Set(prev);
        next.delete(tagId);
        return next;
      });
    } catch (err) {
      console.error('Unassign error:', err);
    }
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    setCreating(true);
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notebookId, name }),
      });
      if (res.ok) {
        const tag: Tag = await res.json();
        setAllTags((prev) => [...prev, tag]);
        // Auto-assign the newly created tag
        await handleAssign(tag.id);
      }
    } catch (err) {
      console.error('Create tag error:', err);
    } finally {
      setCreating(false);
      setNewTagName('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <Loader2 size={12} className="animate-spin text-foreground-muted" />
        <span className="text-[11px] text-foreground-muted">Loading tags...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Assigned tags */}
      <div className="flex flex-wrap gap-1">
        <AnimatePresence>
          {assignedTags.map((tag) => (
            <motion.span
              key={tag.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              {tag.name}
              <button
                onClick={() => handleUnassign(tag.id)}
                className="hover:opacity-70 transition-opacity"
              >
                <X size={10} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>

        {/* Add tag button / dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] text-foreground-muted hover:text-foreground-secondary border border-dashed border-border hover:border-border-hover rounded-full transition-colors"
          >
            <Plus size={10} />
            Tag
            <ChevronDown size={10} />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[160px] max-h-[200px] overflow-y-auto">
              {/* Create new */}
              <div className="px-2 py-1 border-b border-border">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateTag();
                    }}
                    placeholder="New tag..."
                    className="flex-1 px-1.5 py-1 text-[11px] bg-input border border-border rounded text-foreground placeholder:text-foreground-muted focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={handleCreateTag}
                    disabled={creating || !newTagName.trim()}
                    className="p-1 text-accent-blue hover:text-accent-blue-hover disabled:opacity-40"
                  >
                    {creating ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Plus size={11} />
                    )}
                  </button>
                </div>
              </div>

              {/* Unassigned tags */}
              {unassignedTags.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-foreground-muted">
                  No more tags
                </div>
              ) : (
                unassignedTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      handleAssign(tag.id);
                      setDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-foreground-secondary hover:bg-elevated hover:text-foreground transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
