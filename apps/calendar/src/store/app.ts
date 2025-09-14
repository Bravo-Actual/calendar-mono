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
  toggleSelectedDate: (date: Date | string | number) => void;
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

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  selectedDate: new Date(),
  selectedDates: [],
  weekStartMs: getWeekStartMs(),
  days: 7,
  isMultiSelectMode: false,

  // Actions
  setSelectedDate: (date: Date) => set({
    selectedDate: date,
    isMultiSelectMode: false,
    selectedDates: []
  }),

  toggleSelectedDate: (date: Date | string | number) => {
    const state = get();
    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      return;
    }

    const dateStr = dateObj.toDateString();
    const existing = state.selectedDates.find(d => d.toDateString() === dateStr);

    if (existing) {
      // Remove if already selected
      const newDates = state.selectedDates.filter(d => d.toDateString() !== dateStr);
      set({
        selectedDates: newDates,
        isMultiSelectMode: newDates.length > 0
      });
    } else if (state.selectedDates.length < 7) {
      // Add if under 7 days
      const newDates = [...state.selectedDates, dateObj].sort((a, b) => a.getTime() - b.getTime());
      set({
        selectedDates: newDates,
        isMultiSelectMode: true
      });
    }
  },

  clearSelectedDates: () => set({
    selectedDates: [],
    isMultiSelectMode: false
  }),

  setWeekStart: (weekStartMs: number) => set({ weekStartMs }),
  setDays: (days: 5 | 7) => set({ days }),
}));