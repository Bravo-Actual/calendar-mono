import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  isLoading: boolean;
  results: CommandResult[];
  selectedIndex: number;

  // Actions
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
  setQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setResults: (results: CommandResult[]) => void;
  setSelectedIndex: (index: number) => void;
  executeCommand: (command: CommandResult) => void;
  navigateUp: () => void;
  navigateDown: () => void;
}

export interface CommandResult {
  id: string;
  title: string;
  description?: string;
  type: 'search' | 'command' | 'ai' | 'action';
  action?: () => void;
  icon?: string;
  shortcut?: string;
}

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
      // Persist sidebar state and days selection
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        days: state.days,
      }),
    }
  )
);

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  // Initial state
  isOpen: false,
  query: '',
  isLoading: false,
  results: [],
  selectedIndex: 0,

  // Actions
  openPalette: () => set({ isOpen: true, query: '', selectedIndex: 0 }),
  closePalette: () => set({ isOpen: false, query: '', results: [], selectedIndex: 0 }),
  togglePalette: () => {
    const { isOpen } = get();
    if (isOpen) {
      get().closePalette();
    } else {
      get().openPalette();
    }
  },

  setQuery: (query: string) => set({ query, selectedIndex: 0 }),
  setLoading: (isLoading: boolean) => set({ isLoading }),
  setResults: (results: CommandResult[]) => set({ results, selectedIndex: 0 }),
  setSelectedIndex: (selectedIndex: number) => {
    const { results } = get();
    const clampedIndex = Math.max(0, Math.min(selectedIndex, results.length - 1));
    set({ selectedIndex: clampedIndex });
  },

  navigateUp: () => {
    const { selectedIndex } = get();
    get().setSelectedIndex(selectedIndex - 1);
  },

  navigateDown: () => {
    const { selectedIndex, results } = get();
    get().setSelectedIndex(selectedIndex + 1);
  },

  executeCommand: (command: CommandResult) => {
    if (command.action) {
      command.action();
    }
    get().closePalette();
  },
}));