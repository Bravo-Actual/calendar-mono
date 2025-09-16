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
  // Calendar view state
  viewMode: 'consecutive' | 'non-consecutive';

  // Consecutive mode settings
  consecutiveType: 'day' | 'week' | 'workweek' | 'custom-days'; // What type of consecutive view
  customDayCount: number; // 1-14 days for custom-days mode
  startDate: Date; // Starting date for consecutive views

  // Non-consecutive mode
  selectedDates: Date[]; // User-selected individual dates

  // User preferences
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.

  // Legacy fields (will remove after transition)
  selectedDate: Date;
  weekStartMs: number;
  days: 5 | 7;
  isMultiSelectMode: boolean;

  // Sidebar state
  sidebarOpen: boolean;
  sidebarOpenMobile: boolean;
  sidebarTab: 'dates' | 'calendars';

  // Modal state
  settingsModalOpen: boolean;

  // AI Panel state
  aiPanelOpen: boolean;
  aiSelectedPersonaId: string | null;
  aiSelectedModelId: string;

  // Actions
  // Consecutive mode actions
  setConsecutiveView: (type: 'day' | 'week' | 'workweek' | 'custom-days', startDate: Date, customDayCount?: number) => void;
  setCustomDayCount: (count: number) => void;
  setWeekStartDay: (day: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void;
  nextPeriod: () => void;
  prevPeriod: () => void;
  goToToday: () => void;

  // Non-consecutive mode actions
  toggleSelectedDate: (date: Date | string | number) => void;
  clearSelectedDates: () => void;

  // Legacy actions (will remove after transition)
  setSelectedDate: (date: Date) => void;
  setWeekStart: (weekStartMs: number) => void;
  setDays: (days: 5 | 7) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: 'dates' | 'calendars') => void;
  setSettingsModalOpen: (open: boolean) => void;

  // AI Panel actions
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;
  setAiSelectedPersonaId: (personaId: string | null) => void;
  setAiSelectedModelId: (modelId: string) => void;
}

// Helper to get week start (Monday) for a date
const getWeekStartMs = (date = new Date()): number => {
  const d = new Date(date);
  const day = d.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1; // Sunday is 6 days from Monday, others are day-1
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      viewMode: 'consecutive' as const,
      consecutiveType: 'week' as const,
      customDayCount: 7,
      startDate: new Date(),
      selectedDates: [],
      weekStartDay: 1, // Monday

      // Legacy state (will remove after transition)
      selectedDate: new Date(),
      weekStartMs: getWeekStartMs(),
      days: 7,
      isMultiSelectMode: false,

      sidebarOpen: true,
      sidebarOpenMobile: false,
      sidebarTab: 'dates',
      settingsModalOpen: false,

      // AI Panel initial state
      aiPanelOpen: true,
      aiSelectedPersonaId: null,
      aiSelectedModelId: 'x-ai/grok-3', // Default to Grok 3

      // Actions
      // Consecutive mode actions
      setConsecutiveView: (type, startDate, customDayCount) => set({
        viewMode: 'consecutive',
        consecutiveType: type,
        startDate,
        customDayCount: customDayCount || get().customDayCount,
        selectedDates: [], // Clear non-consecutive selection
      }),

      setCustomDayCount: (count) => set({ customDayCount: count }),

      setWeekStartDay: (day) => set({ weekStartDay: day }),

      nextPeriod: () => {
        const state = get();
        if (state.viewMode !== 'consecutive') return;

        let daysToAdd = 1;
        switch (state.consecutiveType) {
          case 'day': daysToAdd = 1; break;
          case 'week': daysToAdd = 7; break;
          case 'workweek': daysToAdd = 7; break; // Navigate by full weeks
          case 'custom-days': daysToAdd = state.customDayCount; break;
        }

        const newStartDate = new Date(state.startDate);
        newStartDate.setDate(newStartDate.getDate() + daysToAdd);
        set({ startDate: newStartDate });
      },

      prevPeriod: () => {
        const state = get();
        if (state.viewMode !== 'consecutive') return;

        let daysToSubtract = 1;
        switch (state.consecutiveType) {
          case 'day': daysToSubtract = 1; break;
          case 'week': daysToSubtract = 7; break;
          case 'workweek': daysToSubtract = 7; break; // Navigate by full weeks
          case 'custom-days': daysToSubtract = state.customDayCount; break;
        }

        const newStartDate = new Date(state.startDate);
        newStartDate.setDate(newStartDate.getDate() - daysToSubtract);
        set({ startDate: newStartDate });
      },

      goToToday: () => {
        const today = new Date();
        const state = get();

        if (state.viewMode === 'consecutive') {
          set({ startDate: today });
        } else {
          // For non-consecutive mode, switch to week view with today
          set({
            viewMode: 'consecutive',
            consecutiveType: 'week',
            startDate: today,
            selectedDates: []
          });
        }
      },

      // Non-consecutive mode actions

      // Legacy actions (will remove after transition)
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
            viewMode: newDates.length > 0 ? 'non-consecutive' : 'consecutive',
            isMultiSelectMode: newDates.length > 0
          });
        } else if (state.selectedDates.length < 14) {
          // Add if under 14 days
          const newDates = [...state.selectedDates, dateObj].sort((a, b) => a.getTime() - b.getTime());
          set({
            selectedDates: newDates,
            viewMode: 'non-consecutive',
            isMultiSelectMode: true
          });
        }
      },

      clearSelectedDates: () => set({
        selectedDates: [],
        viewMode: 'consecutive',
        isMultiSelectMode: false
      }),

      setWeekStart: (weekStartMs: number) => set({ weekStartMs }),
      setDays: (days: 5 | 7) => set({ days }),

      // Sidebar actions
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setSidebarOpenMobile: (open: boolean) => set({ sidebarOpenMobile: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarTab: (sidebarTab: 'dates' | 'calendars') => set({ sidebarTab }),
      setSettingsModalOpen: (settingsModalOpen: boolean) => set({ settingsModalOpen }),

      // AI Panel actions
      setAiPanelOpen: (aiPanelOpen: boolean) => set({ aiPanelOpen }),
      toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
      setAiSelectedPersonaId: (aiSelectedPersonaId: string | null) => set({ aiSelectedPersonaId }),
      setAiSelectedModelId: (aiSelectedModelId: string) => set({ aiSelectedModelId }),
    }),
    {
      name: 'calendar-app-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist user preferences and view settings
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarTab: state.sidebarTab,
        consecutiveType: state.consecutiveType,
        customDayCount: state.customDayCount,
        weekStartDay: state.weekStartDay,
        aiPanelOpen: state.aiPanelOpen,
        aiSelectedPersonaId: state.aiSelectedPersonaId,
        aiSelectedModelId: state.aiSelectedModelId,
        // Legacy
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