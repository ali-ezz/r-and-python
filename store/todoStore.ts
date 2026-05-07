/**
 * @fileoverview Enhanced Zustand store for Tasks — Kanban, subtasks, comments,
 * attachments, recurring, bulk actions, linked notes. localStorage persistence.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'archived';
export type TodoFilter = 'all' | 'todo' | 'in-progress' | 'done' | 'archived' | 'overdue';
export type TodoSort = 'priority' | 'dueDate' | 'created' | 'title';
export type ViewMode = 'list' | 'kanban';

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; weight: number; icon: string }> = {
  urgent: { label: 'Urgent', color: '#9B1C1C', bg: '#FEE2E2', weight: 4, icon: '[Urgent]' },
  high:   { label: 'High',   color: '#B5451B', bg: '#FDEBD0', weight: 3, icon: '[High]' },
  medium: { label: 'Medium', color: '#1E3A5F', bg: '#DBEAFE', weight: 2, icon: '[Medium]' },
  low:    { label: 'Low',    color: '#666666', bg: '#F3F4F6', weight: 1, icon: '[Low]' },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; icon: string }> = {
  'todo':        { label: 'To Do',       color: '#666666', bg: '#F3F4F6', icon: '[Todo]' },
  'in-progress': { label: 'In Progress', color: '#1E3A5F', bg: '#DBEAFE', icon: '[Active]' },
  'done':        { label: 'Done',        color: '#2D6A4F', bg: '#D8F3DC', icon: '[Done]' },
  'archived':    { label: 'Archived',    color: '#999999', bg: '#F0F0F0', icon: '[Archived]' },
};

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  type: 'link' | 'file';
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  subtasks: Subtask[];
  comments: TaskComment[];
  attachments: TaskAttachment[];
  linkedNoteId: string | null;
  isRecurring: boolean;
  recurringInterval: 'daily' | 'weekly' | 'monthly' | null;
  tags: string[];
}

function gid(prefix = 'td'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function isOverdue(todo: Todo): boolean {
  if (todo.status === 'done' || todo.status === 'archived' || !todo.dueDate) return false;
  return new Date(todo.dueDate) < new Date(new Date().toDateString());
}

interface TodoState {
  todos: Todo[];
  selectedIds: string[];
  addTodo: (data: Pick<Todo, 'title' | 'description' | 'priority' | 'dueDate' | 'tags'>) => void;
  updateTodo: (id: string, updates: Partial<Todo>) => void;
  deleteTodo: (id: string) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  clearCompleted: () => void;
  markAllStatus: (status: TaskStatus) => void;
  // Subtasks
  addSubtask: (todoId: string, title: string) => void;
  toggleSubtask: (todoId: string, subtaskId: string) => void;
  deleteSubtask: (todoId: string, subtaskId: string) => void;
  // Comments
  addComment: (todoId: string, text: string, author: string) => void;
  deleteComment: (todoId: string, commentId: string) => void;
  // Attachments
  addAttachment: (todoId: string, name: string, url: string) => void;
  deleteAttachment: (todoId: string, attachmentId: string) => void;
  // Bulk
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  bulkSetStatus: (status: TaskStatus) => void;
  bulkSetPriority: (priority: Priority) => void;
  bulkDelete: () => void;
  // Link
  linkNote: (todoId: string, noteId: string | null) => void;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set, get) => ({
      todos: [],
      selectedIds: [],

      addTodo: (data) =>
        set((s) => ({
          todos: [{
            id: gid(), ...data, status: 'todo' as TaskStatus,
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
            completedAt: null, subtasks: [], comments: [], attachments: [],
            linkedNoteId: null, isRecurring: false, recurringInterval: null, tags: data.tags || [],
          }, ...s.todos],
        })),

      updateTodo: (id, updates) =>
        set((s) => ({
          todos: s.todos.map((t) => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
        })),

      deleteTodo: (id) =>
        set((s) => ({ todos: s.todos.filter((t) => t.id !== id), selectedIds: s.selectedIds.filter((i) => i !== id) })),

      setStatus: (id, status) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === id ? {
              ...t, status, updatedAt: new Date().toISOString(),
              completedAt: status === 'done' ? new Date().toISOString() : t.completedAt,
            } : t,
          ),
        })),

      clearCompleted: () =>
        set((s) => ({ todos: s.todos.filter((t) => t.status !== 'done') })),

      markAllStatus: (status) =>
        set((s) => ({
          todos: s.todos.map((t) => t.status === 'archived' ? t : {
            ...t, status, updatedAt: new Date().toISOString(),
            completedAt: status === 'done' ? new Date().toISOString() : null,
          }),
        })),

      // Subtasks
      addSubtask: (todoId, title) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? { ...t, subtasks: [...t.subtasks, { id: gid('st'), title, completed: false }], updatedAt: new Date().toISOString() } : t,
          ),
        })),

      toggleSubtask: (todoId, subtaskId) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? {
              ...t,
              subtasks: t.subtasks.map((st) => st.id === subtaskId ? { ...st, completed: !st.completed } : st),
              updatedAt: new Date().toISOString(),
            } : t,
          ),
        })),

      deleteSubtask: (todoId, subtaskId) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? { ...t, subtasks: t.subtasks.filter((st) => st.id !== subtaskId), updatedAt: new Date().toISOString() } : t,
          ),
        })),

      // Comments
      addComment: (todoId, text, author) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? {
              ...t,
              comments: [...t.comments, { id: gid('cm'), text, author, createdAt: new Date().toISOString() }],
              updatedAt: new Date().toISOString(),
            } : t,
          ),
        })),

      deleteComment: (todoId, commentId) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? { ...t, comments: t.comments.filter((c) => c.id !== commentId), updatedAt: new Date().toISOString() } : t,
          ),
        })),

      // Attachments
      addAttachment: (todoId, name, url) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? {
              ...t,
              attachments: [...t.attachments, { id: gid('at'), name, url, type: 'link' as const }],
              updatedAt: new Date().toISOString(),
            } : t,
          ),
        })),

      deleteAttachment: (todoId, attachmentId) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            t.id === todoId ? { ...t, attachments: t.attachments.filter((a) => a.id !== attachmentId), updatedAt: new Date().toISOString() } : t,
          ),
        })),

      // Bulk
      toggleSelect: (id) =>
        set((s) => ({
          selectedIds: s.selectedIds.includes(id)
            ? s.selectedIds.filter((i) => i !== id)
            : [...s.selectedIds, id],
        })),

      selectAll: () => set((s) => ({ selectedIds: s.todos.map((t) => t.id) })),
      clearSelection: () => set({ selectedIds: [] }),

      bulkSetStatus: (status) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            s.selectedIds.includes(t.id) ? {
              ...t, status, updatedAt: new Date().toISOString(),
              completedAt: status === 'done' ? new Date().toISOString() : null,
            } : t,
          ),
          selectedIds: [],
        })),

      bulkSetPriority: (priority) =>
        set((s) => ({
          todos: s.todos.map((t) =>
            s.selectedIds.includes(t.id) ? { ...t, priority, updatedAt: new Date().toISOString() } : t,
          ),
          selectedIds: [],
        })),

      bulkDelete: () =>
        set((s) => ({
          todos: s.todos.filter((t) => !s.selectedIds.includes(t.id)),
          selectedIds: [],
        })),

      // Link
      linkNote: (todoId, noteId) =>
        set((s) => ({
          todos: s.todos.map((t) => t.id === todoId ? { ...t, linkedNoteId: noteId, updatedAt: new Date().toISOString() } : t),
        })),
    }),
    { name: 'sms-todos', partialize: (s) => ({ todos: s.todos }) },
  ),
);
