import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AppState {
  // Date range state
  selectedDate: Date;
  selectedDates: Date[];
  weekStartMs: number;
  days: 5 | 7;
  isMultiSelectMode: boolean;

  // Sidebar state
  sidebarOpen: boolean;
  sidebarOpenMobile: boolean;

  // Actions
  setSelectedDate: (date: Date) => void;
  toggleSelectedDate: (date: Date | string | number) => void;
  clearSelectedDates: () => void;
  setWeekStart: (weekStartMs: number) => void;
  setDays: (days: 5 | 7) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
}

// Helper to get week start (Sunday) for a date
const getWeekStartMs = (date = new Date()): number => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Sunday = 0, so subtract day directly
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      selectedDate: new Date(),
      selectedDates: [],
      weekStartMs: getWeekStartMs(),
      days: 7,
      isMultiSelectMode: false,
      sidebarOpen: true,
      sidebarOpenMobile: false,

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

      // Sidebar actions
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setSidebarOpenMobile: (open: boolean) => set({ sidebarOpenMobile: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'calendar-app-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist the sidebar state (not date state which should be session-based)
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);