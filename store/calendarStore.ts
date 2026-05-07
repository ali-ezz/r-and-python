/**
 * @fileoverview Zustand store for Calendar — events CRUD, date navigation.
 * Persisted to localStorage via zustand/persist.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EventCategory = 'Lecture' | 'Assignment' | 'Exam' | 'Meeting' | 'Personal' | 'Other';

export const EVENT_CATEGORIES: { id: EventCategory; color: string; bg: string }[] = [
  { id: 'Lecture',    color: '#1E3A5F', bg: '#DBEAFE' },
  { id: 'Assignment', color: '#B5451B', bg: '#FDEBD0' },
  { id: 'Exam',       color: '#9B1C1C', bg: '#FEE2E2' },
  { id: 'Meeting',    color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'Personal',   color: '#2D6A4F', bg: '#D8F3DC' },
  { id: 'Other',      color: '#666666', bg: '#F3F4F6' },
];

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;       // ISO date string YYYY-MM-DD
  time: string;       // HH:MM
  category: EventCategory;
  description: string;
}

interface CalendarState {
  events: CalendarEvent[];
  selectedDate: string | null;
  currentMonth: number;  // 0-11
  currentYear: number;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id'>>) => void;
  deleteEvent: (id: string) => void;
  setSelectedDate: (date: string | null) => void;
  navigateMonth: (delta: number) => void;
  goToToday: () => void;
}

function generateId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const now = new Date();

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      events: [],
      selectedDate: null,
      currentMonth: now.getMonth(),
      currentYear: now.getFullYear(),

      addEvent: (event) =>
        set((state) => ({
          events: [...state.events, { ...event, id: generateId() }],
        })),

      updateEvent: (id, updates) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      deleteEvent: (id) =>
        set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

      setSelectedDate: (date) => set({ selectedDate: date }),

      navigateMonth: (delta) =>
        set((state) => {
          let m = state.currentMonth + delta;
          let y = state.currentYear;
          if (m < 0) { m = 11; y--; }
          if (m > 11) { m = 0; y++; }
          return { currentMonth: m, currentYear: y };
        }),

      goToToday: () =>
        set({
          currentMonth: new Date().getMonth(),
          currentYear: new Date().getFullYear(),
          selectedDate: new Date().toISOString().split('T')[0],
        }),
    }),
    {
      name: 'sms-calendar',
      partialize: (state) => ({ events: state.events }),
    },
  ),
);
