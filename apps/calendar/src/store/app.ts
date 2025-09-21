import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CalendarContext } from '@/components/types';

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

  // Display mode
  displayMode: 'grid' | 'agenda';

  // Consecutive mode settings
  consecutiveType: 'day' | 'week' | 'workweek' | 'custom-days'; // What type of consecutive view
  customDayCount: number; // 1-14 days for custom-days mode
  startDate: Date; // Starting date for consecutive views

  // Non-consecutive mode
  selectedDates: Date[]; // User-selected individual dates

  // User preferences
  weekStartDay: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sunday, 1=Monday, etc.
  timezone: string; // IANA timezone identifier
  timeFormat: '12_hour' | '24_hour';

  // Legacy fields (will remove after transition)
  selectedDate: Date;
  rangeStartMs: number;
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

  // Event Details Panel state
  eventDetailsPanelOpen: boolean;
  selectedEventForDetails: string | null;

  // Calendar visibility state
  selectedCalendarIds: Set<string>;

  // Calendar Context for AI Chat Integration
  currentCalendarContext: CalendarContext;

  // Actions
  // Consecutive mode actions
  setConsecutiveView: (type: 'day' | 'week' | 'workweek' | 'custom-days', startDate: Date, customDayCount?: number) => void;
  setCustomDayCount: (count: number) => void;
  setWeekStartDay: (day: 0 | 1 | 2 | 3 | 4 | 5 | 6) => void;
  setTimezone: (timezone: string) => void;
  setTimeFormat: (format: '12_hour' | '24_hour') => void;
  nextPeriod: () => void;
  prevPeriod: () => void;
  goToToday: () => void;

  // Non-consecutive mode actions
  toggleSelectedDate: (date: Date | string | number) => void;
  clearSelectedDates: () => void;

  // Legacy actions (will remove after transition)
  setSelectedDate: (date: Date) => void;
  setRangeStart: (rangeStartMs: number) => void;
  setDays: (days: 5 | 7) => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (tab: 'dates' | 'calendars') => void;
  setSettingsModalOpen: (open: boolean) => void;

  // Display mode actions
  setDisplayMode: (mode: 'grid' | 'agenda') => void;
  toggleDisplayMode: () => void;

  // AI Panel actions
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;

  // Event Details Panel actions
  setEventDetailsPanelOpen: (open: boolean) => void;
  toggleEventDetailsPanel: () => void;
  setSelectedEventForDetails: (eventId: string | null) => void;
  openEventDetails: (eventId: string) => void;
  closeEventDetails: () => void;

  // Calendar visibility actions
  setSelectedCalendarIds: (calendarIds: Set<string>) => void;
  toggleCalendarVisibility: (calendarId: string) => void;
  selectAllCalendars: (calendarIds: string[]) => void;
  clearCalendarSelection: () => void;

  // Calendar Context actions
  setCalendarContext: (context: Partial<CalendarContext>) => void;
  updateCalendarContext: (updates: Partial<CalendarContext>) => void;
  clearCalendarContext: () => void;
  buildCalendarContextWithSummaries: (
    viewRange: { start: string; end: string; description: string },
    viewDates: { dates: string[]; description: string },
    selectedEvents: import('@/components/types').CalEvent[],
    selectedTimeRanges: { ranges: { start: string; end: string; description: string }[]; description: string },
    currentView: 'week' | 'day' | 'month',
    currentDate: string,
    allVisibleEvents?: import('@/components/types').CalEvent[]
  ) => CalendarContext;
}

// Helper to get range start (Monday) for a date
const getRangeStartMs = (date = new Date()): number => {
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
      displayMode: 'grid' as const,
      consecutiveType: 'week' as const,
      customDayCount: 7,
      startDate: new Date(),
      selectedDates: [],
      weekStartDay: 0, // Sunday (default)
      timezone: 'UTC', // Default timezone
      timeFormat: '12_hour', // Default time format

      // Legacy state (will remove after transition)
      selectedDate: new Date(),
      rangeStartMs: getRangeStartMs(),
      days: 7,
      isMultiSelectMode: false,

      sidebarOpen: true,
      sidebarOpenMobile: false,
      sidebarTab: 'dates',
      settingsModalOpen: false,

      // AI Panel initial state
      aiPanelOpen: true,

      // Event Details Panel initial state
      eventDetailsPanelOpen: false,
      selectedEventForDetails: null,

      // Calendar visibility initial state
      selectedCalendarIds: new Set(),

      // Calendar Context initial state
      currentCalendarContext: {
        viewRange: {
          start: new Date().toISOString(),
          end: new Date().toISOString(),
          description: "This is the date range currently visible on the calendar"
        },
        viewDates: {
          dates: [],
          description: "These are all the individual dates currently visible on the calendar"
        },
        selectedEvents: {
          events: [],
          description: "These are events on the calendar that the user has selected"
        },
        selectedTimeRanges: {
          ranges: [],
          description: "These are time slots that the user has manually selected on the calendar"
        },
        currentView: 'week',
        currentDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      },

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

      setTimezone: (timezone) => set({ timezone }),

      setTimeFormat: (timeFormat) => set({ timeFormat }),

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

      setRangeStart: (rangeStartMs: number) => set({ rangeStartMs }),
      setDays: (days: 5 | 7) => set({ days }),

      // Sidebar actions
      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
      setSidebarOpenMobile: (open: boolean) => set({ sidebarOpenMobile: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarTab: (sidebarTab: 'dates' | 'calendars') => set({ sidebarTab }),
      setSettingsModalOpen: (settingsModalOpen: boolean) => set({ settingsModalOpen }),

      // Display mode actions
      setDisplayMode: (displayMode: 'grid' | 'agenda') => set({ displayMode }),
      toggleDisplayMode: () => set((state) => ({ displayMode: state.displayMode === 'grid' ? 'agenda' : 'grid' })),

      // AI Panel actions
      setAiPanelOpen: (aiPanelOpen: boolean) => set({ aiPanelOpen }),
      toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),

      // Event Details Panel actions
      setEventDetailsPanelOpen: (eventDetailsPanelOpen: boolean) => set({ eventDetailsPanelOpen }),
      toggleEventDetailsPanel: () => set((state) => ({ eventDetailsPanelOpen: !state.eventDetailsPanelOpen })),
      setSelectedEventForDetails: (selectedEventForDetails: string | null) => set({ selectedEventForDetails }),
      openEventDetails: (eventId: string) => set({
        eventDetailsPanelOpen: true,
        selectedEventForDetails: eventId
      }),
      closeEventDetails: () => set({
        eventDetailsPanelOpen: false,
        selectedEventForDetails: null
      }),

      // Calendar visibility actions
      setSelectedCalendarIds: (selectedCalendarIds: Set<string>) => set({ selectedCalendarIds }),

      toggleCalendarVisibility: (calendarId: string) => set((state) => {
        const newSelectedCalendarIds = new Set(state.selectedCalendarIds);
        if (newSelectedCalendarIds.has(calendarId)) {
          newSelectedCalendarIds.delete(calendarId);
        } else {
          newSelectedCalendarIds.add(calendarId);
        }
        return { selectedCalendarIds: newSelectedCalendarIds };
      }),

      selectAllCalendars: (calendarIds: string[]) => set({
        selectedCalendarIds: new Set(calendarIds)
      }),

      clearCalendarSelection: () => set({
        selectedCalendarIds: new Set()
      }),

      // Calendar Context actions
      setCalendarContext: (context: Partial<CalendarContext>) => set({
        currentCalendarContext: context as CalendarContext
      }),

      updateCalendarContext: (updates: Partial<CalendarContext>) => set((state) => ({
        currentCalendarContext: {
          ...state.currentCalendarContext,
          ...updates
        }
      })),

      clearCalendarContext: () => set({
        currentCalendarContext: {
          viewRange: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
            description: "This is the date range currently visible on the calendar"
          },
          viewDates: {
            dates: [],
            description: "These are all the individual dates currently visible on the calendar"
          },
          selectedEvents: {
            events: [],
            description: "These are events on the calendar that the user has selected",
            summary: "No events currently selected"
          },
          selectedTimeRanges: {
            ranges: [],
            description: "These are time slots that the user has manually selected on the calendar",
            summary: "No time ranges selected"
          },
          currentView: 'week',
          currentDate: new Date().toISOString().split('T')[0],
          categories: {
            events_by_category: [],
            summary: "No events to categorize"
          },
          view_summary: "Empty calendar view"
        }
      }),

      // Helper function to build calendar context with summaries
      buildCalendarContextWithSummaries: (
        viewRange: { start: string; end: string; description: string },
        viewDates: { dates: string[]; description: string },
        selectedEvents: CalEvent[],
        selectedTimeRanges: { ranges: { start: string; end: string; description: string }[]; description: string },
        currentView: 'week' | 'day' | 'month',
        currentDate: string,
        allVisibleEvents: CalEvent[] = []
      ): CalendarContext => {
        // Generate summaries
        const selectedEventsSummary = selectedEvents.length === 0
          ? "No events currently selected"
          : selectedEvents.length === 1
          ? "There is 1 event in the user selection"
          : `There are ${selectedEvents.length} events in the user selection`;

        const timeRangesSummary = selectedTimeRanges.ranges.length === 0
          ? "No time ranges selected"
          : (() => {
            const totalMinutes = selectedTimeRanges.ranges.reduce((sum, range) => {
              const start = new Date(range.start).getTime();
              const end = new Date(range.end).getTime();
              return sum + (end - start) / (1000 * 60);
            }, 0);

            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const timeText = hours > 0
              ? `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} minutes` : ''}`
              : `${minutes} minutes`;

            const dayCount = new Set(selectedTimeRanges.ranges.map(range =>
              new Date(range.start).toDateString()
            )).size;

            const selectionCount = selectedTimeRanges.ranges.length;

            return `The user has selected ${timeText} of time, spread across ${selectionCount} selection${selectionCount !== 1 ? 's' : ''}${dayCount > 1 ? ` on ${dayCount} separate days` : ''}`;
          })();

        // Build category summary
        const categoryMap = new Map<string, { name: string; color: string; count: number; duration: number }>();

        allVisibleEvents.forEach(event => {
          const categoryName = event.user_category_name || 'Uncategorized';
          const categoryColor = event.user_category_color || 'neutral';
          const duration = event.duration || 0;

          if (categoryMap.has(categoryName)) {
            const cat = categoryMap.get(categoryName)!;
            cat.count++;
            cat.duration += duration;
          } else {
            categoryMap.set(categoryName, {
              name: categoryName,
              color: categoryColor,
              count: 1,
              duration: duration
            });
          }
        });

        const categoriesArray = Array.from(categoryMap.values()).map(cat => ({
          category_name: cat.name,
          category_color: cat.color,
          event_count: cat.count,
          total_duration_minutes: cat.duration
        }));

        const categoriesSummary = categoriesArray.length === 0
          ? "No events to categorize"
          : categoriesArray.length === 1
          ? `All events are in the ${categoriesArray[0].category_name} category`
          : (() => {
            const categoryTexts = categoriesArray.map(cat => {
              const hours = Math.floor(cat.total_duration_minutes / 60);
              const minutes = cat.total_duration_minutes % 60;
              const timeText = hours > 0
                ? `${hours} hour${hours !== 1 ? 's' : ''}${minutes > 0 ? ` ${minutes}min` : ''}`
                : `${minutes}min`;
              return `${cat.category_name} (${cat.event_count} event${cat.event_count !== 1 ? 's' : ''}, ${timeText})`;
            });
            return `Events span ${categoriesArray.length} categories: ${categoryTexts.join(', ')}`;
          })();

        // Generate view summary
        const totalEvents = allVisibleEvents.length;
        const totalCategories = categoriesArray.length;
        const viewTypeText = currentView === 'week' ? 'week' : currentView === 'day' ? 'day' : 'month';
        const dateText = new Date(currentDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        const viewSummary = totalEvents === 0
          ? `Viewing ${viewTypeText} of ${dateText} with no events scheduled`
          : `Viewing ${viewTypeText} of ${dateText} with ${totalEvents} event${totalEvents !== 1 ? 's' : ''} scheduled${totalCategories > 1 ? ` across ${totalCategories} categories` : ''}`;

        return {
          viewRange,
          viewDates,
          selectedEvents: {
            events: selectedEvents,
            description: "These are events on the calendar that the user has selected",
            summary: selectedEventsSummary
          },
          selectedTimeRanges: {
            ranges: selectedTimeRanges.ranges,
            description: "These are time slots that the user has manually selected on the calendar",
            summary: timeRangesSummary
          },
          currentView,
          currentDate,
          categories: {
            events_by_category: categoriesArray,
            summary: categoriesSummary
          },
          view_summary: viewSummary
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
        consecutiveType: state.consecutiveType,
        customDayCount: state.customDayCount,
        weekStartDay: state.weekStartDay,
        timezone: state.timezone,
        timeFormat: state.timeFormat,
        aiPanelOpen: state.aiPanelOpen, // Only persist panel visibility, not chat state
        selectedCalendarIds: Array.from(state.selectedCalendarIds), // Convert Set to Array for persistence
        // Legacy
        days: state.days,
      }),
      // Custom serialization for Set types
      serialize: (state) => {
        const serialized = {
          ...state,
          selectedCalendarIds: Array.from(state.selectedCalendarIds)
        };
        return JSON.stringify(serialized);
      },
      deserialize: (str) => {
        const parsed = JSON.parse(str);
        return {
          ...parsed,
          selectedCalendarIds: new Set(parsed.selectedCalendarIds || [])
        };
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