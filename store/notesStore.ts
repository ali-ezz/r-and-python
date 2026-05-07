/**
 * @fileoverview Enhanced Zustand store for Notes — folders, tags, version history,
 * markdown support, linked tasks, export, soft-delete. localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoteCategory = 'Academic' | 'Personal' | 'Research' | 'Meeting' | 'General';

export const NOTE_CATEGORIES: { id: NoteCategory; color: string; bg: string }[] = [
  { id: 'Academic', color: '#1E3A5F', bg: '#DBEAFE' },
  { id: 'Personal', color: '#2D6A4F', bg: '#D8F3DC' },
  { id: 'Research', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'Meeting',  color: '#B5451B', bg: '#FDEBD0' },
  { id: 'General',  color: '#666666', bg: '#F3F4F6' },
];

const DEFAULT_FOLDERS = ['General', 'Lectures', 'Assignments', 'Personal'];
const DEFAULT_TAGS = ['important', 'review', 'exam', 'project', 'draft'];

export interface NoteVersion {
  id: string;
  content: string;
  savedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  folder: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  linkedTaskId: string | null;
  versions: NoteVersion[];
  createdAt: string;
  updatedAt: string;
}

function gid(prefix = 'n'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function uniqueClean(values: unknown[], fallback: string[] = []) {
  return Array.from(new Set(
    [...fallback, ...values]
      .map((value) => String(value || '').trim())
      .filter(Boolean),
  ));
}

function normalizeCategory(value: unknown): NoteCategory {
  return NOTE_CATEGORIES.some((category) => category.id === value) ? value as NoteCategory : 'General';
}

function normalizeNote(raw: Partial<Note> & Record<string, unknown>): Note {
  const now = new Date().toISOString();
  const content = String(raw.content || '');
  const versions = Array.isArray(raw.versions)
    ? raw.versions.filter((version): version is NoteVersion =>
      Boolean(version && typeof version === 'object' && 'content' in version && 'savedAt' in version),
    )
    : [];

  return {
    id: String(raw.id || gid()),
    title: String(raw.title || 'Untitled Note'),
    content,
    category: normalizeCategory(raw.category),
    folder: String(raw.folder || 'General'),
    tags: Array.isArray(raw.tags) ? uniqueClean(raw.tags.map((tag) => String(tag).toLowerCase())) : [],
    pinned: Boolean(raw.pinned),
    archived: Boolean(raw.archived),
    linkedTaskId: raw.linkedTaskId ? String(raw.linkedTaskId) : null,
    versions: versions.length > 0 ? versions : [{ id: gid('v'), content, savedAt: String(raw.updatedAt || now) }],
    createdAt: String(raw.createdAt || now),
    updatedAt: String(raw.updatedAt || now),
  };
}

interface NotesState {
  notes: Note[];
  folders: string[];
  allTags: string[];
  addNote: (title: string, content: string, category: NoteCategory, folder: string, tags: string[]) => string;
  updateNote: (id: string, updates: Partial<Pick<Note, 'title' | 'content' | 'category' | 'folder' | 'tags'>>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  archiveNote: (id: string) => void;
  restoreNote: (id: string) => void;
  linkTask: (noteId: string, taskId: string | null) => void;
  addFolder: (name: string) => void;
  deleteFolder: (name: string) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: [],
      folders: DEFAULT_FOLDERS,
      allTags: DEFAULT_TAGS,

      addNote: (title, content, category, folder, tags) => {
        const id = gid();
        const now = new Date().toISOString();
        const cleanTags = uniqueClean(tags.map((tag) => tag.toLowerCase()));
        const cleanFolder = folder.trim() || 'General';
        set((s) => ({
          notes: [{
            id, title, content, category, folder: cleanFolder, tags: cleanTags,
            pinned: false, archived: false, linkedTaskId: null,
            versions: [{ id: gid('v'), content, savedAt: new Date().toISOString() }],
            createdAt: now, updatedAt: now,
          }, ...s.notes],
          folders: uniqueClean([cleanFolder], s.folders),
          allTags: uniqueClean(cleanTags, s.allTags),
        }));
        return id;
      },

      updateNote: (id, updates) =>
        set((s) => ({
          notes: s.notes.map((n) => {
            if (n.id !== id) return n;
            const updated = { ...normalizeNote(n), ...updates, updatedAt: new Date().toISOString() };
            // Save version if content changed
            if (updates.content !== undefined && updates.content !== n.content) {
              updated.versions = [
                { id: gid('v'), content: updates.content, savedAt: new Date().toISOString() },
                ...(n.versions ?? []).slice(0, 19), // Keep last 20 versions
              ];
            }
            return updated;
          }),
        })),

      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      togglePin: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n),
        })),

      archiveNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => n.id === id ? { ...n, archived: true, updatedAt: new Date().toISOString() } : n),
        })),

      restoreNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => n.id === id ? { ...n, archived: false, updatedAt: new Date().toISOString() } : n),
        })),

      linkTask: (noteId, taskId) =>
        set((s) => ({
          notes: s.notes.map((n) => n.id === noteId ? { ...n, linkedTaskId: taskId, updatedAt: new Date().toISOString() } : n),
        })),

      addFolder: (name) =>
        set((s) => ({ folders: s.folders.includes(name) ? s.folders : [...s.folders, name] })),

      deleteFolder: (name) =>
        set((s) => ({
          folders: s.folders.filter((f) => f !== name),
          notes: s.notes.map((n) => n.folder === name ? { ...normalizeNote(n), folder: 'General' } : normalizeNote(n)),
        })),

      addTag: (tag) =>
        set((s) => ({ allTags: s.allTags.includes(tag) ? s.allTags : [...s.allTags, tag] })),

      removeTag: (tag) =>
        set((s) => ({
          allTags: s.allTags.filter((t) => t !== tag),
          notes: s.notes.map((n) => {
            const normalized = normalizeNote(n);
            return { ...normalized, tags: normalized.tags.filter((t) => t !== tag) };
          }),
        })),
    }),
    {
      name: 'sms-notes',
      version: 1,
      merge: (persisted, current) => {
        const saved = persisted as Partial<NotesState> | undefined;
        const notes = Array.isArray(saved?.notes) ? saved.notes.map((note) => normalizeNote(note)) : current.notes;
        return {
          ...current,
          ...saved,
          notes,
          folders: uniqueClean(notes.map((note) => note.folder), Array.isArray(saved?.folders) ? saved.folders : current.folders),
          allTags: uniqueClean(notes.flatMap((note) => note.tags), Array.isArray(saved?.allTags) ? saved.allTags : current.allTags),
        };
      },
    },
  ),
);
