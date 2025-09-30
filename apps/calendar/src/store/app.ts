import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CalendarContext } from '@/components/types';
import type { EventResolved } from '@/lib/data-v2';

export interface CalendarSelection {
  type: 'event' | 'task' | 'reminder' | 'annotation' | 'timeRange';
  id?: string; // For items with IDs
  data?: any; // Full item data for convenience
  start_time?: Date; // For time-based selections
  end_time?: Date;
}

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
  viewMode: 'dateRange' | 'dateArray';

  // Display mode
  displayMode: 'grid' | 'v2';

  // Date Range mode settings (formerly consecutive)
  dateRangeType: 'day' | 'week' | 'workweek' | 'custom-days'; // What type of date range view
  customDayCount: number; // 1-14 days for custom-days mode
  startDate: Date; // Starting date for date range views

  // Date Array mode (formerly dateArray)
  selectedDates: Date[]; // User-selected individual dates

  // User preferences
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.
  timezone: string; // IANA timezone identifier
  timeFormat: '12_hour' | '24_hour';


  // Sidebar state
  sidebarOpen: boolean;
  sidebarOpenMobile: boolean;
  sidebarTab: 'dates' | 'calendars';

  // Modal state
  settingsModalOpen: boolean;

  // AI Panel state
  aiPanelOpen: boolean;

  // Developer tools state
  devToolsVisible: boolean;

  // Calendar visibility state - track HIDDEN calendars (default = all visible)
  hiddenCalendarIds: Set<string>;

  // Calendar selection state - minimal storage for AI context
  selectedEventIds: EventResolved['id'][];
  selectedTimeRanges: Array<{ start: Date; end: Date }>;

  // Actions
  // Date Range mode actions (formerly consecutive)
  setDateRangeView: (
    type: 'day' | 'week' | 'workweek' | 'custom-days',
    startDate: Date,
    customDayCount?: number
  ) => void;
  setCustomDayCount: (count: number) => void;
  setWeekStartDay: (day: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void;
  setTimezone: (timezone: string) => void;
  setTimeFormat: (format: '12_hour' | '24_hour') => void;
  nextPeriod: () => void;
  prevPeriod: () => void;
  goToToday: () => void;

  // Date Array mode actions (formerly dateArray)
  toggleSelectedDate: (date: Date | string | number) => void;
  clearSelectedDates: () => void;

  setSidebarOpen: (open: boolean) => void;
  setSidebarOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: 'dates' | 'calendars') => void;
  setSettingsModalOpen: (open: boolean) => void;

  // Display mode actions
  setDisplayMode: (mode: 'grid' | 'v2') => void;
  toggleDisplayMode: () => void;

  // AI Panel actions
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;

  // Developer tools actions
  setDevToolsVisible: (visible: boolean) => void;
  toggleDevTools: () => void;

  // Calendar visibility actions
  toggleCalendarVisibility: (calendarId: string) => void;

  // Calendar selection actions - simple setters for calendar grid
  setSelectedEventIds: (eventIds: EventResolved['id'][]) => void;
  setSelectedTimeRanges: (ranges: Array<{ start: Date; end: Date }>) => void;
  clearSelectedEvents: () => void;
  clearSelectedTimeRanges: () => void;
  clearAllSelections: () => void;

  // On-demand calendar context builder for AI integration
  getCalendarContext: () => CalendarContext;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      viewMode: 'dateRange' as const,
      displayMode: 'grid' as const,
      dateRangeType: 'week' as const,
      customDayCount: 7,
      startDate: new Date(),
      selectedDates: [],
      weekStartDay: 0, // Sunday (default)
      timezone: 'UTC', // Default timezone
      timeFormat: '12_hour', // Default time format


      sidebarOpen: true,
      sidebarOpenMobile: false,
      sidebarTab: 'dates',
      settingsModalOpen: false,

      // AI Panel initial state
      aiPanelOpen: true,

      // Developer tools initial state
      devToolsVisible: false,

      // Calendar visibility initial state - empty = all calendars visible
      hiddenCalendarIds: new Set(),

      // Calendar selection initial state - minimal storage
      selectedEventIds: [],
      selectedTimeRanges: [],

      // Actions
      // Date Range mode actions (formerly consecutive)
      setDateRangeView: (type, startDate, customDayCount) =>
        set({
          viewMode: 'dateRange',
          dateRangeType: type,
          startDate,
          customDayCount: customDayCount || get().customDayCount,
          selectedDates: [], // Clear date array selection
        }),

      setCustomDayCount: (count) => set({ customDayCount: count }),

      setWeekStartDay: (day) => set({ weekStartDay: day }),

      setTimezone: (timezone) => set({ timezone }),

      setTimeFormat: (timeFormat) => set({ timeFormat }),

      nextPeriod: () => {
        const state = get();
        if (state.viewMode !== 'dateRange') return;

        let daysToAdd = 1;
        switch (state.dateRangeType) {
          case 'day':
            daysToAdd = 1;
            break;
          case 'week':
            daysToAdd = 7;
            break;
          case 'workweek':
            daysToAdd = 7;
            break; // Navigate by full weeks
          case 'custom-days':
            daysToAdd = state.customDayCount;
            break;
        }

        const newStartDate = new Date(state.startDate);
        newStartDate.setDate(newStartDate.getDate() + daysToAdd);
        set({ startDate: newStartDate });
      },

      prevPeriod: () => {
        const state = get();
        if (state.viewMode !== 'dateRange') return;

        let daysToSubtract = 1;
        switch (state.dateRangeType) {
          case 'day':
            daysToSubtract = 1;
            break;
          case 'week':
            daysToSubtract = 7;
            break;
          case 'workweek':
            daysToSubtract = 7;
            break; // Navigate by full weeks
          case 'custom-days':
            daysToSubtract = state.customDayCount;
            break;
        }

        const newStartDate = new Date(state.startDate);
        newStartDate.setDate(newStartDate.getDate() - daysToSubtract);
        set({ startDate: newStartDate });
      },

      goToToday: () => {
        const today = new Date();
        const state = get();

        if (state.viewMode === 'dateRange') {
          set({ startDate: today });
        } else {
          // For date array mode, switch to week view with today
          set({
            viewMode: 'dateRange',
            dateRangeType: 'week',
            startDate: today,
            selectedDates: [],
          });
        }
      },

      // Non-consecutive mode actions

      toggleSelectedDate: (date: Date | string | number) => {
        const state = get();
        const dateObj = new Date(date);

        if (Number.isNaN(dateObj.getTime())) {
          return;
        }

        const dateStr = dateObj.toDateString();
        const existing = state.selectedDates.find((d) => d.toDateString() === dateStr);

        if (existing) {
          // Remove if already selected
          const newDates = state.selectedDates.filter((d) => d.toDateString() !== dateStr);
          set({
            selectedDates: newDates,
            viewMode: newDates.length > 0 ? 'dateArray' : 'dateRange',
          });
        } else if (state.selectedDates.length < 14) {
          // Add if under 14 days
          const newDates = [...state.selectedDates, dateObj].sort(
            (a, b) => a.getTime() - b.getTime()
          );
          set({
            selectedDates: newDates,
            viewMode: 'dateArray',
          });
        }
      },

      clearSelectedDates: () =>
        set({
          selectedDates: [],
          viewMode: 'dateRange',
        }),


      // Sidebar actions
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setSidebarOpenMobile: (open: boolean) => set({ sidebarOpenMobile: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarTab: (sidebarTab: 'dates' | 'calendars') => set({ sidebarTab }),
      setSettingsModalOpen: (settingsModalOpen: boolean) => set({ settingsModalOpen }),

      // Display mode actions
      setDisplayMode: (displayMode: 'grid' | 'v2') => set({ displayMode }),
      toggleDisplayMode: () =>
        set((state) => ({ displayMode: state.displayMode === 'grid' ? 'v2' : 'grid' })),

      // AI Panel actions
      setAiPanelOpen: (aiPanelOpen: boolean) => set({ aiPanelOpen }),
      toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

      // Developer tools actions
      setDevToolsVisible: (devToolsVisible: boolean) => set({ devToolsVisible }),
      toggleDevTools: () => set((state) => ({ devToolsVisible: !state.devToolsVisible })),

      // Calendar visibility actions
      setHiddenCalendarIds: (hiddenCalendarIds: Set<string>) => set({ hiddenCalendarIds }),

      toggleCalendarVisibility: (calendarId: string) =>
        set((state) => {
          const newHiddenCalendarIds = new Set(state.hiddenCalendarIds);
          if (newHiddenCalendarIds.has(calendarId)) {
            // Calendar is hidden, make it visible
            newHiddenCalendarIds.delete(calendarId);
          } else {
            // Calendar is visible, hide it
            newHiddenCalendarIds.add(calendarId);
          }
          return { hiddenCalendarIds: newHiddenCalendarIds };
        }),

      showAllCalendars: () =>
        set({
          hiddenCalendarIds: new Set(),
        }),

      hideAllCalendars: (calendarIds: string[]) =>
        set({
          hiddenCalendarIds: new Set(calendarIds),
        }),



      // NEW: Simple calendar selection actions for calendar grid
      setSelectedEventIds: (eventIds: EventResolved['id'][]) =>
        set({ selectedEventIds: eventIds }),

      setSelectedTimeRanges: (ranges: Array<{ start: Date; end: Date }>) =>
        set({ selectedTimeRanges: ranges }),

      clearSelectedEvents: () => set({ selectedEventIds: [] }),

      clearSelectedTimeRanges: () => set({ selectedTimeRanges: [] }),

      clearAllSelections: () =>
        set({ selectedEventIds: [], selectedTimeRanges: [] }),

      // NEW: On-demand calendar context builder for AI integration
      getCalendarContext: (): CalendarContext => {
        const state = get();

        // Build current view information
        const currentView = state.viewMode === 'dateRange' && state.dateRangeType === 'week' ? 'week' : 'day';
        const currentDate = state.startDate.toISOString().split('T')[0];

        // Calculate date range based on current view state
        const startDate = state.startDate;
        let endDate = new Date(startDate);
        if (state.viewMode === 'dateRange') {
          if (state.dateRangeType === 'week') {
            endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
          } else if (state.dateRangeType === 'workweek') {
            endDate = new Date(startDate.getTime() + 4 * 24 * 60 * 60 * 1000);
          } else if (state.dateRangeType === 'custom-days') {
            endDate = new Date(startDate.getTime() + (state.customDayCount - 1) * 24 * 60 * 60 * 1000);
          }
        }

        // Generate simple time range format for AI
        const viewRange = {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          description: `${state.dateRangeType} view from ${currentDate}`,
        };

        // Generate dates array for AI context
        const viewDates = {
          dates: state.viewMode === 'dateArray'
            ? state.selectedDates.map(d => d.toISOString().split('T')[0])
            : [currentDate],
          description: state.viewMode === 'dateArray'
            ? 'User-selected individual dates'
            : `Consecutive dates in ${state.dateRangeType} view`,
        };

        // Note: selectedEvents would need to be queried from data layer
        // This is a placeholder - actual implementation would use event queries
        const selectedEvents = {
          events: [], // TODO: Query events by selectedEventIds when needed
          description: 'Events currently selected by user',
          summary: state.selectedEventIds.length === 0
            ? 'No events currently selected'
            : `${state.selectedEventIds.length} events selected`,
        };

        // Convert time ranges to AI format
        const selectedTimeRanges = {
          ranges: state.selectedTimeRanges.map(range => ({
            start: range.start.toISOString(),
            end: range.end.toISOString(),
            description: 'User-selected time range',
          })),
          description: 'Time slots manually selected by user',
          summary: state.selectedTimeRanges.length === 0
            ? 'No time ranges selected'
            : `${state.selectedTimeRanges.length} time ranges selected`,
        };

        return {
          viewRange,
          viewDates,
          selectedEvents,
          selectedTimeRanges,
          currentView,
          viewDetails: {
            mode: state.viewMode,
            dateRangeType: state.dateRangeType,
            dayCount: state.customDayCount,
            startDate: currentDate,
            endDate: endDate.toISOString().split('T')[0],
            description: `${state.dateRangeType} view`,
          },
          currentDate,
          view_summary: `Viewing ${currentView} calendar with ${state.selectedEventIds.length} events selected`,
          timezone: state.timezone,
          currentDateTime: {
            utc: new Date().toISOString(),
            local: new Date().toISOString(),
            timestamp: Date.now(),
            description: `Current time (${state.timezone})`,
          },
        };
      },
    }),
    {
      name: 'calendar-app-storage',
      storage: createJSONStorage(() => localStorage),
      // Persist user preferences and view settings
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        sidebarTab: state.sidebarTab,
        displayMode: state.displayMode,
        dateRangeType: state.dateRangeType,
        customDayCount: state.customDayCount,
        weekStartDay: state.weekStartDay,
        timezone: state.timezone,
        timeFormat: state.timeFormat,
        aiPanelOpen: state.aiPanelOpen, // Only persist panel visibility, not chat state
        devToolsVisible: state.devToolsVisible, // Persist dev tools visibility
        hiddenCalendarIds: Array.from(state.hiddenCalendarIds), // Convert Set to Array for persistence
      }),
      // Handle Set deserialization
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.hiddenCalendarIds)) {
          state.hiddenCalendarIds = new Set(state.hiddenCalendarIds);
        }
      },
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
    const { selectedIndex } = get();
    get().setSelectedIndex(selectedIndex + 1);
  },

  executeCommand: (command: CommandResult) => {
    if (command.action) {
      command.action();
    }
    get().closePalette();
  },
}));
