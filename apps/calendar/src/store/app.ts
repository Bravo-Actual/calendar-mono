import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
  displayMode: 'grid' | 'agenda' | 'v2';

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


  // Calendar visibility state - track HIDDEN calendars (default = all visible)
  hiddenCalendarIds: Set<string>;

  // Calendar Context for AI Chat Integration
  currentCalendarContext: CalendarContext;

  // AI Highlights state (separate from user selections)
  aiHighlightedEvents: Set<string>; // Event IDs highlighted by AI
  aiHighlightedTimeRanges: Array<{
    start: string; // ISO timestamp
    end: string;   // ISO timestamp
    description?: string; // Optional context for the highlight
  }>;

  // Calendar selection state - multi-selection support
  calendarSelections: CalendarSelection[];

  // Actions
  // Date Range mode actions (formerly consecutive)
  setDateRangeView: (type: 'day' | 'week' | 'workweek' | 'custom-days', startDate: Date, customDayCount?: number) => void;
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
  setDisplayMode: (mode: 'grid' | 'agenda' | 'v2') => void;
  toggleDisplayMode: () => void;

  // AI Panel actions
  setAiPanelOpen: (open: boolean) => void;
  toggleAiPanel: () => void;


  // Calendar visibility actions
  toggleCalendarVisibility: (calendarId: string) => void;

  // Calendar Context actions
  setCalendarContext: (context: Partial<CalendarContext>) => void;
  updateCalendarContext: (updates: Partial<CalendarContext>) => void;
  clearCalendarContext: () => void;
  buildCalendarContextWithSummaries: (
    viewRange: { start: string; end: string; description: string },
    viewDates: { dates: string[]; description: string },
    selectedEvents: EventResolved[],
    selectedTimeRanges: { ranges: { start: string; end: string; description: string }[]; description: string },
    currentView: 'week' | 'day' | 'month',
    currentDate: string,
    allVisibleEvents?: EventResolved[]
  ) => CalendarContext;

  // AI Highlight actions (separate from user selection actions)
  setAiHighlightedEvents: (eventIds: string[]) => void;
  addAiHighlightedEvent: (eventId: string) => void;
  removeAiHighlightedEvent: (eventId: string) => void;
  clearAiHighlightedEvents: () => void;
  setAiHighlightedTimeRanges: (ranges: Array<{start: string; end: string; description?: string}>) => void;
  addAiHighlightedTimeRange: (range: {start: string; end: string; description?: string}) => void;
  removeAiHighlightedTimeRange: (index: number) => void;
  clearAiHighlightedTimeRanges: () => void;
  clearAllAiHighlights: () => void;

  // Calendar selection actions
  addCalendarSelection: (selection: CalendarSelection) => void;
  removeCalendarSelection: (type: string, id?: string) => void;
  clearCalendarSelections: () => void;
  setCalendarSelections: (selections: CalendarSelection[]) => void;
  toggleCalendarSelection: (selection: CalendarSelection) => void;
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
      viewMode: 'dateRange' as const,
      displayMode: 'grid' as const,
      dateRangeType: 'week' as const,
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


      // Calendar visibility initial state - empty = all calendars visible
      hiddenCalendarIds: new Set(),

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
          description: "These are events on the calendar that the user has selected",
          summary: "No events selected"
        },
        selectedTimeRanges: {
          ranges: [],
          description: "These are time slots that the user has manually selected on the calendar",
          summary: "No time ranges selected"
        },
        currentView: 'week',
        viewDetails: {
          mode: 'dateRange' as const,
          dateRangeType: 'week' as const,
          dayCount: 7,
          startDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          endDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
          description: "week view"
        },
        currentDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        timezone: 'UTC', // Will be updated when user profile loads
        currentDateTime: {
          utc: new Date().toISOString(),
          local: new Date().toISOString(),
          timestamp: Date.now(),
          description: "Current time (will be updated with proper timezone)"
        },
        categories: {
          events_by_category: [],
          summary: "No events to categorize"
        },
        view_summary: "Calendar view with no events loaded"
      },

      // AI Highlights initial state (separate from user selections)
      aiHighlightedEvents: new Set(),
      aiHighlightedTimeRanges: [],

      // Calendar selection initial state
      calendarSelections: [],

      // Actions
      // Date Range mode actions (formerly consecutive)
      setDateRangeView: (type, startDate, customDayCount) => set({
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
        if (state.viewMode !== 'dateRange') return;

        let daysToSubtract = 1;
        switch (state.dateRangeType) {
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

        if (state.viewMode === 'dateRange') {
          set({ startDate: today });
        } else {
          // For date array mode, switch to week view with today
          set({
            viewMode: 'dateRange',
            dateRangeType: 'week',
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
            viewMode: newDates.length > 0 ? 'dateArray' : 'dateRange',
            isMultiSelectMode: newDates.length > 0
          });
        } else if (state.selectedDates.length < 14) {
          // Add if under 14 days
          const newDates = [...state.selectedDates, dateObj].sort((a, b) => a.getTime() - b.getTime());
          set({
            selectedDates: newDates,
            viewMode: 'dateArray',
            isMultiSelectMode: true
          });
        }
      },

      clearSelectedDates: () => set({
        selectedDates: [],
        viewMode: 'dateRange',
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
      setDisplayMode: (displayMode: 'grid' | 'agenda' | 'v2') => set({ displayMode }),
      toggleDisplayMode: () => set((state) => ({ displayMode: state.displayMode === 'grid' ? 'agenda' : 'grid' })),

      // AI Panel actions
      setAiPanelOpen: (aiPanelOpen: boolean) => set({ aiPanelOpen }),
      toggleAiPanel: () => set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),


      // Calendar visibility actions
      setHiddenCalendarIds: (hiddenCalendarIds: Set<string>) => set({ hiddenCalendarIds }),

      toggleCalendarVisibility: (calendarId: string) => set((state) => {
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

      showAllCalendars: () => set({
        hiddenCalendarIds: new Set()
      }),

      hideAllCalendars: (calendarIds: string[]) => set({
        hiddenCalendarIds: new Set(calendarIds)
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

      clearCalendarContext: () => set((state) => {
        const now = new Date();
        return {
          currentCalendarContext: {
            viewRange: {
              start: now.toISOString(),
              end: now.toISOString(),
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
            viewDetails: {
              mode: 'dateRange' as const,
              dateRangeType: 'week' as const,
              dayCount: 7,
              startDate: now.toISOString().split('T')[0],
              endDate: now.toISOString().split('T')[0],
              description: "week view"
            },
            currentDate: now.toISOString().split('T')[0],
            categories: {
              events_by_category: [],
              summary: "No events to categorize"
            },
            view_summary: "Empty calendar view",
            timezone: state.timezone, // Preserve current timezone
            currentDateTime: {
              utc: now.toISOString(),
              local: now.toISOString(), // Will be properly formatted when calendar updates
              timestamp: now.getTime(),
              description: `Current time (${state.timezone})`
            }
          }
        };
      }),

      // Helper function to build calendar context with summaries
      buildCalendarContextWithSummaries: (
        viewRange: { start: string; end: string; description: string },
        viewDates: { dates: string[]; description: string },
        selectedEvents: EventResolved[],
        selectedTimeRanges: { ranges: { start: string; end: string; description: string }[]; description: string },
        currentView: 'week' | 'day' | 'month',
        currentDate: string,
        allVisibleEvents: EventResolved[] = []
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

        // Build clean category and calendar mappings for AI context
        const categoryMap = new Map<string, { id: string | null; name: string; color: string; count: number }>();
        const calendarMap = new Map<string, { id: string | null; name: string; color: string; count: number }>();

        allVisibleEvents.forEach(event => {
          const categoryId = event.category?.id;
          const categoryName = event.category?.name || 'Uncategorized';
          const categoryColor = event.category?.color || 'neutral';

          if (categoryMap.has(categoryName)) {
            const cat = categoryMap.get(categoryName)!;
            cat.count++;
          } else {
            categoryMap.set(categoryName, {
              id: categoryId || null,
              name: categoryName,
              color: categoryColor,
              count: 1
            });
          }

          const calendarId = event.calendar?.id;
          const calendarName = event.calendar?.name || 'Default Calendar';
          const calendarColor = event.calendar?.color || 'neutral';

          if (calendarMap.has(calendarName)) {
            const cal = calendarMap.get(calendarName)!;
            cal.count++;
          } else {
            calendarMap.set(calendarName, {
              id: calendarId || null,
              name: calendarName,
              color: calendarColor,
              count: 1
            });
          }
        });

        const categoriesArray = Array.from(categoryMap.values()).map(cat => ({
          id: cat.id,
          name: cat.name,
          color: cat.color,
          event_count: cat.count
        }));

        const calendarsArray = Array.from(calendarMap.values()).map(cal => ({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          event_count: cal.count
        }));

        const categoriesSummary = categoriesArray.length === 0
          ? "No events to categorize"
          : categoriesArray.length === 1
          ? `All events are in the ${categoriesArray[0].name} category`
          : (() => {
            const categoryTexts = categoriesArray.map(cat =>
              `${cat.name} (${cat.event_count} event${cat.event_count !== 1 ? 's' : ''})`
            );
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

        const now = new Date();
        const state = get();

        // Build viewDetails that match the navigation tool structure
        const viewDetails = (() => {
          if (state.viewMode === 'dateArray') {
            // Non-consecutive mode
            const dates = state.selectedDates.map(date =>
              date.toISOString().split('T')[0] // YYYY-MM-DD format
            );
            const dateRangeText = dates.length === 1 ? dates[0] : `${dates[0]} through ${dates[dates.length - 1]}`;
            return {
              mode: 'dateArray' as const,
              dates,
              description: `User is viewing ${dates.length} selected date${dates.length !== 1 ? 's' : ''} (${dateRangeText}) in dateArray mode. Only navigate away if you need to show content outside these specific dates. If the dates you want to highlight are already visible, use highlighting tools instead of navigation.`
            };
          } else {
            // Consecutive mode
            const dayCount = state.dateRangeType === 'day' ? 1
              : state.dateRangeType === 'week' ? 7
              : state.dateRangeType === 'workweek' ? 5
              : state.customDayCount;

            const startDateStr = state.startDate.toISOString().split('T')[0];
            const endDateObj = new Date(state.startDate);
            endDateObj.setDate(endDateObj.getDate() + dayCount - 1);
            const endDateStr = endDateObj.toISOString().split('T')[0];

            const viewTypeText = state.dateRangeType === 'day' ? "day view"
              : state.dateRangeType === 'week' ? "week view"
              : state.dateRangeType === 'workweek' ? "work week view (Monday-Friday)"
              : `${dayCount}-day custom view`;

            return {
              mode: 'dateRange' as const,
              dateRangeType: state.dateRangeType,
              dayCount,
              startDate: startDateStr,
              endDate: endDateStr,
              description: `User is viewing ${viewTypeText} from ${startDateStr} to ${endDateStr} (${dayCount} days). Only navigate away if you need to show content outside this date range. If the events/times you want to highlight are already within this range, use highlighting tools instead of navigation to preserve the user's current view.`
            };
          }
        })();

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
          viewDetails,
          currentDate,
          view_summary: viewSummary,
          timezone: state.timezone,
          currentDateTime: {
            utc: now.toISOString(),
            local: now.toISOString(), // Will be properly formatted by calendar
            timestamp: now.getTime(),
            description: `Current time (${state.timezone})`
          }
        };
      },

      // AI Highlight actions (separate from user selection actions)
      setAiHighlightedEvents: (eventIds: string[]) => set({
        aiHighlightedEvents: new Set(eventIds)
      }),

      addAiHighlightedEvent: (eventId: string) => set((state) => {
        const newSet = new Set(state.aiHighlightedEvents);
        newSet.add(eventId);
        return { aiHighlightedEvents: newSet };
      }),

      removeAiHighlightedEvent: (eventId: string) => set((state) => {
        const newSet = new Set(state.aiHighlightedEvents);
        newSet.delete(eventId);
        return { aiHighlightedEvents: newSet };
      }),

      clearAiHighlightedEvents: () => set({
        aiHighlightedEvents: new Set()
      }),

      setAiHighlightedTimeRanges: (ranges) => set({
        aiHighlightedTimeRanges: ranges
      }),

      addAiHighlightedTimeRange: (range) => set((state) => ({
        aiHighlightedTimeRanges: [...state.aiHighlightedTimeRanges, range]
      })),

      removeAiHighlightedTimeRange: (index: number) => set((state) => ({
        aiHighlightedTimeRanges: state.aiHighlightedTimeRanges.filter((_, i) => i !== index)
      })),

      clearAiHighlightedTimeRanges: () => set({
        aiHighlightedTimeRanges: []
      }),

      clearAllAiHighlights: () => set({
        aiHighlightedEvents: new Set(),
        aiHighlightedTimeRanges: []
      }),

      // Calendar selection actions
      addCalendarSelection: (selection: CalendarSelection) => set((state) => ({
        calendarSelections: [...state.calendarSelections, selection]
      })),

      removeCalendarSelection: (type: string, id?: string) => set((state) => ({
        calendarSelections: state.calendarSelections.filter(selection => {
          if (id) {
            // Remove specific item by type and id
            return !(selection.type === type && selection.id === id);
          } else {
            // Remove all items of this type
            return selection.type !== type;
          }
        })
      })),

      clearCalendarSelections: () => set({
        calendarSelections: []
      }),

      setCalendarSelections: (selections: CalendarSelection[]) => set({
        calendarSelections: selections
      }),

      toggleCalendarSelection: (selection: CalendarSelection) => set((state) => {
        const existing = state.calendarSelections.find(s => {
          if (selection.id) {
            return s.type === selection.type && s.id === selection.id;
          } else if (selection.start_time && selection.end_time) {
            // For time ranges, match by type and time bounds
            return s.type === selection.type &&
                   s.start_time?.getTime() === selection.start_time?.getTime() &&
                   s.end_time?.getTime() === selection.end_time?.getTime();
          } else {
            return s.type === selection.type;
          }
        });

        if (existing) {
          // Remove if already exists
          return {
            calendarSelections: state.calendarSelections.filter(s => s !== existing)
          };
        } else {
          // Add if doesn't exist
          return {
            calendarSelections: [...state.calendarSelections, selection]
          };
        }
      }),
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
        hiddenCalendarIds: Array.from(state.hiddenCalendarIds), // Convert Set to Array for persistence
        // Legacy
        days: state.days,
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