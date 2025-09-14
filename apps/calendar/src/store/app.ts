import { create } from 'zustand';

export interface AppState {
  // Date range state
  selectedDate: Date;
  selectedDates: Date[];
  weekStartMs: number;
  days: 5 | 7;
  isMultiSelectMode: boolean;

  // Actions
  setSelectedDate: (date: Date) => void;
  toggleSelectedDate: (date: Date) => void;
  clearSelectedDates: () => void;
  setWeekStart: (weekStartMs: number) => void;
  setDays: (days: 5 | 7) => void;
}

// Helper to get week start (Sunday) for a date
const getWeekStartMs = (date = new Date()): number => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Sunday = 0, so subtract day directly
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  selectedDate: new Date(),
  weekStartMs: getWeekStartMs(),
  days: 7,

  // Actions
  setSelectedDate: (date: Date) => set({ selectedDate: date }),
  setWeekStart: (weekStartMs: number) => set({ weekStartMs }),
  setDays: (days: 5 | 7) => set({ days }),
}));