import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CalendarContext } from '@/components/types';
import type { ClientAnnotation, EventResolved } from '@/lib/data-v2';
import type { TimeItem } from '@/components/cal-grid/types';

export interface CalendarSelection {
  type: 'event' | 'task' | 'reminder' | 'annotation' | 'timeRange';
  id?: string; // For items with IDs
  data?: TimeItem | EventResolved | ClientAnnotation; // Full item data for convenience
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

  // Event Details Panel state
  eventDetailsPanelOpen: boolean;

  // Developer tools state
  devToolsVisible: boolean;
  showAllAiTools: boolean;

  // Calendar visibility state - track HIDDEN calendars (default = all visible)
  hiddenCalendarIds: Set<string>;

  // AI Highlights visibility state (default = visible)
  aiHighlightsVisible: boolean;

  // Navigation glow state - for AI navigation feedback
  showNavigationGlow: boolean;

  // Calendar selection state - minimal storage for AI context
  selectedEventIds: EventResolved['id'][];
  selectedTimeRanges: Array<{ start: Date; end: Date }>;

  // Primary selected event (for event details panel)
  selectedEventPrimary: string | null;

  // Time selection mode - when enabled, clicking calendar selects time range
  timeSelectionMode: boolean;
  timeSelectionCallback: ((start: Date, end: Date) => void) | null;

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

  // Event Details Panel actions
  setEventDetailsPanelOpen: (open: boolean) => void;
  toggleEventDetailsPanel: () => void;

  // Developer tools actions
  setDevToolsVisible: (visible: boolean) => void;
  toggleDevTools: () => void;
  setShowAllAiTools: (show: boolean) => void;
  toggleShowAllAiTools: () => void;

  // Calendar visibility actions
  toggleCalendarVisibility: (calendarId: string) => void;
  toggleAiHighlights: () => void;

  // Navigation glow actions
  triggerNavigationGlow: () => void;

  // Calendar selection actions - simple setters for calendar grid
  setSelectedEventIds: (eventIds: EventResolved['id'][]) => void;
  setSelectedTimeRanges: (ranges: Array<{ start: Date; end: Date }>) => void;
  clearSelectedEvents: () => void;
  clearSelectedTimeRanges: () => void;
  clearAllSelections: () => void;

  // Primary event selection actions
  setSelectedEventPrimary: (eventId: string | null) => void;

  // Time selection mode actions
  enableTimeSelectionMode: (callback: (start: Date, end: Date) => void) => void;
  disableTimeSelectionMode: () => void;

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

      // Event Details Panel initial state
      eventDetailsPanelOpen: true,

      // Developer tools initial state
      devToolsVisible: false,
      showAllAiTools: false,

      // Calendar visibility initial state - empty = all calendars visible
      hiddenCalendarIds: new Set(),

      // AI Highlights visibility initial state - visible by default
      aiHighlightsVisible: true,

      // Navigation glow initial state
      showNavigationGlow: false,

      // Calendar selection initial state - minimal storage
      selectedEventIds: [],
      selectedTimeRanges: [],

      // Primary selected event initial state
      selectedEventPrimary: null,

      // Time selection mode initial state
      timeSelectionMode: false,
      timeSelectionCallback: null,

      // Actions
      // Date Range mode actions (formerly consecutive)
      setDateRangeView: (type, startDate, customDayCount) => {
        set({
          viewMode: 'dateRange',
          dateRangeType: type,
          startDate: new Date(startDate), // Create new Date instance to ensure reference change
          customDayCount: customDayCount || get().customDayCount,
          selectedDates: [], // Clear date array selection
        });
      },

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

      // Event Details Panel actions
      setEventDetailsPanelOpen: (eventDetailsPanelOpen: boolean) => set({ eventDetailsPanelOpen }),
      toggleEventDetailsPanel: () =>
        set((state) => ({ eventDetailsPanelOpen: !state.eventDetailsPanelOpen })),

      // Developer tools actions
      setDevToolsVisible: (devToolsVisible: boolean) => set({ devToolsVisible }),
      toggleDevTools: () => set((state) => ({ devToolsVisible: !state.devToolsVisible })),
      setShowAllAiTools: (showAllAiTools: boolean) => set({ showAllAiTools }),
      toggleShowAllAiTools: () => set((state) => ({ showAllAiTools: !state.showAllAiTools })),

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

      toggleAiHighlights: () =>
        set((state) => ({ aiHighlightsVisible: !state.aiHighlightsVisible })),

      // Navigation glow action
      triggerNavigationGlow: () => {
        set({ showNavigationGlow: true });
        setTimeout(() => {
          set({ showNavigationGlow: false });
        }, 3000);
      },

      // NEW: Simple calendar selection actions for calendar grid
      setSelectedEventIds: (eventIds: EventResolved['id'][]) => set({ selectedEventIds: eventIds }),

      setSelectedTimeRanges: (ranges: Array<{ start: Date; end: Date }>) =>
        set({ selectedTimeRanges: ranges }),

      clearSelectedEvents: () => set({ selectedEventIds: [] }),

      clearSelectedTimeRanges: () => set({ selectedTimeRanges: [] }),

      clearAllSelections: () => set({ selectedEventIds: [], selectedTimeRanges: [] }),

      // Primary event selection actions
      setSelectedEventPrimary: (eventId) => set({ selectedEventPrimary: eventId }),

      // Time selection mode actions
      enableTimeSelectionMode: (callback) =>
        set({ timeSelectionMode: true, timeSelectionCallback: callback }),
      disableTimeSelectionMode: () =>
        set({ timeSelectionMode: false, timeSelectionCallback: null }),

      // NEW: On-demand calendar context builder for AI integration
      // Only includes user selections (events, time ranges) - view range/dates sent separately
      getCalendarContext: (): CalendarContext => {
        const state = get();

        // Selected event IDs (TODO: Query actual event data from data layer when needed)
        const selectedEvents = {
          eventIds: state.selectedEventIds,
          count: state.selectedEventIds.length,
          summary:
            state.selectedEventIds.length === 0
              ? 'No events selected'
              : `${state.selectedEventIds.length} event${state.selectedEventIds.length > 1 ? 's' : ''} selected`,
        };

        // Selected time ranges (user clicked/selected time slots)
        const selectedTimeRanges = {
          ranges: state.selectedTimeRanges.map((range) => ({
            start: range.start.toISOString(),
            end: range.end.toISOString(),
          })),
          count: state.selectedTimeRanges.length,
          summary:
            state.selectedTimeRanges.length === 0
              ? 'No time slots selected'
              : `${state.selectedTimeRanges.length} time slot${state.selectedTimeRanges.length > 1 ? 's' : ''} selected`,
        };

        return {
          selectedEvents,
          selectedTimeRanges,
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
        eventDetailsPanelOpen: state.eventDetailsPanelOpen, // Persist event details panel visibility
        devToolsVisible: state.devToolsVisible, // Persist dev tools visibility
        showAllAiTools: state.showAllAiTools, // Persist show all AI tools setting
        hiddenCalendarIds: Array.from(state.hiddenCalendarIds), // Convert Set to Array for persistence
        aiHighlightsVisible: state.aiHighlightsVisible, // Persist AI highlights visibility
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
